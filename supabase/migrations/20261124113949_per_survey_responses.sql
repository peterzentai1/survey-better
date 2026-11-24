begin;

create schema survey_data;
create schema survey_admin;
revoke all on schema survey_data, survey_admin from public, anon, authenticated;
grant usage on schema survey_data, survey_admin to service_role;

create table survey_admin.surveys (
  slug text primary key check (slug ~ '^[a-z0-9_]{3,40}$'),
  accepting_responses boolean not null default false,
  retention_until date,
  paradata boolean not null default false,
  check (not accepting_responses or retention_until is not null)
);

create table survey_data.responses (
  survey_slug text not null references survey_admin.surveys (slug),
  receipt_hash bytea not null check (octet_length(receipt_hash) = 32),
  received_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (survey_slug, receipt_hash)
) partition by list (survey_slug);

alter table survey_admin.surveys enable row level security;
alter table survey_data.responses enable row level security;
revoke all on survey_admin.surveys, survey_data.responses from public, anon, authenticated, service_role;
grant select on survey_data.responses to service_role;

create function survey_admin.create_survey(slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  partition_name text;
begin
  if slug is null or slug !~ '^[a-z0-9_]{3,40}$' then
    raise exception 'Invalid survey slug' using errcode = '22023';
  end if;
  insert into survey_admin.surveys values (slug) on conflict do nothing;

  partition_name := 'responses_' || slug;
  execute format('create table if not exists survey_data.%I partition of survey_data.responses for values in (%L)',
    partition_name, slug);
  execute format('alter table survey_data.%I enable row level security', partition_name);
  execute format('revoke all on survey_data.%I from public, anon, authenticated, service_role', partition_name);
end;
$$;

revoke all on function survey_admin.create_survey(text) from public, anon, authenticated, service_role;
grant execute on function survey_admin.create_survey(text) to service_role;

create function public.submit_response(slug text, receipt text, payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  allow_paradata boolean;
  clean_payload jsonb;
begin
  if slug is null or slug !~ '^[a-z0-9_]{3,40}$' or
     receipt is null or octet_length(receipt) not between 1 and 128 or
     payload is null or jsonb_typeof(payload) <> 'object' or
     payload -> 'completed' is distinct from 'true'::jsonb or
     payload #> '{consent,participation}' is distinct from 'true'::jsonb or
     octet_length(payload::text) > 262144 then
    raise exception 'Invalid survey response' using errcode = '22023';
  end if;

  select s.paradata into allow_paradata from survey_admin.surveys as s
  where s.slug = submit_response.slug and s.accepting_responses
    and s.retention_until >= (statement_timestamp() at time zone 'UTC')::date
  for share;
  if not found then
    raise exception 'Survey does not accept responses' using errcode = '22023';
  end if;

  clean_payload := payload - 'sessionId';
  if not allow_paradata or payload #> '{consent,paradata}' is distinct from 'true'::jsonb then
    clean_payload := jsonb_set(clean_payload - 'paradata' - 'effortChangedFromDefault',
      '{consent,paradata}', 'false');
  end if;
  insert into survey_data.responses (survey_slug, receipt_hash, payload)
  values (slug, sha256(convert_to(receipt, 'UTF8')), clean_payload)
  on conflict (survey_slug, receipt_hash) do nothing;
end;
$$;

create function public.survey_response_count(slug text)
returns bigint language sql stable security definer set search_path = '' as $$
  select case when exists (select from survey_admin.surveys s where s.slug = $1)
    then (select count(*) from survey_data.responses r where r.survey_slug = $1)
  end
$$;

create function public.export_survey_responses(slug text, after_receipt text default null, page_size integer default 200)
returns table (receipt_hash text, received_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = '' as $$
  select encode(r.receipt_hash, 'hex'), r.received_at, r.payload
  from survey_data.responses r
  where r.survey_slug = slug and (after_receipt is null or r.receipt_hash > decode(after_receipt, 'hex'))
  order by r.receipt_hash
  limit greatest(1, least(page_size, 500))
$$;

revoke all on function public.submit_response(text,text,jsonb), public.survey_response_count(text),
  public.export_survey_responses(text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.submit_response(text,text,jsonb), public.survey_response_count(text) to anon, authenticated;
grant execute on function public.export_survey_responses(text,text,integer) to service_role;

-- Preserve the original metrics API and legacy rows for the default survey.
alter table survey_private.completions
  alter column arm drop not null,
  add column survey_slug text not null default 'haztartasi_rugalmassag'
    check (survey_slug ~ '^[a-z0-9_]{3,40}$');

create or replace view survey_private.effort_medians with (security_barrier = true) as
  select bank_version, effort, round((percentile_cont(0.5) within group
    (order by active_seconds))::numeric / 60, 1) as median_minutes
  from survey_private.completions where active_seconds is not null and survey_slug = 'haztartasi_rugalmassag'
  group by bank_version, effort having count(*) >= 5;

create or replace view survey_private.temperature_ab as
  select bank_version, effort, arm, count(*) as completions,
    count(*) filter (where reaction_status = 'answered') as answered,
    count(*) filter (where reaction_status = 'skipped') as skipped,
    count(*) filter (where first_input = 'drag') as used_drag,
    count(first_answer_ms) as timed_answers,
    percentile_cont(0.5) within group (order by first_answer_ms) as median_first_answer_ms,
    count(use_again) as rated_use_again,
    count(*) filter (where use_again >= 4) as willing_to_use_again,
    survey_slug
  from survey_private.completions where arm is not null group by bank_version, effort, arm, survey_slug;

create function public.submit_survey_metrics(
  slug text, token text, bank_version text, effort text, active_seconds integer, arm text,
  reaction_status text, first_input text, first_answer_ms integer, use_again smallint
) returns void language sql security invoker set search_path = '' as $$
  insert into survey_private.completions (receipt, bank_version, effort, active_seconds, arm,
    reaction_status, first_input, first_answer_ms, use_again, survey_slug)
  values (sha256(convert_to(case when slug = 'haztartasi_rugalmassag' then token else slug || ':' || token end, 'UTF8')),
    bank_version, effort, active_seconds, arm, reaction_status, first_input, first_answer_ms, use_again, slug)
  on conflict do nothing
$$;

create function public.survey_effort_medians(slug text, version text)
returns table (effort text, median_minutes numeric)
language sql stable security definer set search_path = '' as $$
  select c.effort, round((percentile_cont(0.5) within group
    (order by c.active_seconds))::numeric / 60, 1)
  from survey_private.completions c
  where c.survey_slug = slug and c.bank_version = version and c.active_seconds is not null
  group by c.effort having count(*) >= 5
$$;

revoke all on function public.submit_survey_metrics(text,text,text,text,integer,text,text,text,integer,smallint),
  public.survey_effort_medians(text,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_survey_metrics(text,text,text,text,integer,text,text,text,integer,smallint),
  public.survey_effort_medians(text,text) to anon, authenticated;

commit;
