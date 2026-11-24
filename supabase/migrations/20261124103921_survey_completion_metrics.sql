create schema survey_private;
revoke all on schema survey_private from public;
grant usage on schema survey_private to anon, authenticated;

create table survey_private.completions (
  receipt bytea primary key,
  bank_version text not null check (length(bank_version) between 1 and 40),
  effort text not null check (effort in ('rovid', 'kozepes', 'alapos')),
  active_seconds integer check (active_seconds > 0),
  arm text not null check (arm in ('tap', 'drag')),
  reaction_status text not null check (reaction_status in ('answered', 'skipped', 'not_shown')),
  first_input text check (first_input in ('tap', 'drag', 'key')),
  first_answer_ms integer check (first_answer_ms >= 0 and first_answer_ms % 100 = 0),
  use_again smallint check (use_again between 1 and 6),
  check ((first_answer_ms is null) = (first_input is null))
);
alter table survey_private.completions enable row level security;
revoke all on survey_private.completions from public, anon, authenticated;
grant insert on survey_private.completions to anon, authenticated;
create policy submit_completion on survey_private.completions for insert to anon, authenticated
  with check (true);

create function public.submit_survey_completion(
  token text, bank_version text, effort text, active_seconds integer, arm text,
  reaction_status text, first_input text, first_answer_ms integer, use_again smallint
) returns void language sql security invoker set search_path = '' as $$
  insert into survey_private.completions
  values (sha256(convert_to(token, 'UTF8')), bank_version, effort, active_seconds,
          arm, reaction_status, first_input, first_answer_ms, use_again)
  on conflict do nothing
$$;

-- Only this fixed, rounded aggregate may read raw completion times on behalf of a visitor.
create view survey_private.effort_medians with (security_barrier = true) as
  select bank_version, effort, round((percentile_cont(0.5) within group
    (order by active_seconds))::numeric / 60, 1) as median_minutes
  from survey_private.completions where active_seconds is not null
  group by bank_version, effort having count(*) >= 5;
grant select on survey_private.effort_medians to anon, authenticated;

create function public.survey_effort_medians(version text)
returns table (effort text, median_minutes numeric)
language sql stable security invoker set search_path = '' as $$
  select m.effort, m.median_minutes from survey_private.effort_medians m where m.bank_version = version
$$;
revoke all on function public.submit_survey_completion(text,text,text,integer,text,text,text,integer,smallint),
  public.survey_effort_medians(text) from public, anon, authenticated;
grant execute on function public.submit_survey_completion(text,text,text,integer,text,text,text,integer,smallint),
  public.survey_effort_medians(text) to anon, authenticated;

-- Researcher-only comparison, grouped by randomized assignment (including keyboard users).
create view survey_private.temperature_ab as
  select bank_version, effort, arm, count(*) as completions,
    count(*) filter (where reaction_status = 'answered') as answered,
    count(*) filter (where reaction_status = 'skipped') as skipped,
    count(*) filter (where first_input = 'drag') as used_drag,
    count(first_answer_ms) as timed_answers,
    percentile_cont(0.5) within group (order by first_answer_ms) as median_first_answer_ms,
    count(use_again) as rated_use_again,
    count(*) filter (where use_again >= 4) as willing_to_use_again
  from survey_private.completions group by bank_version, effort, arm;
revoke all on survey_private.temperature_ab from public, anon, authenticated;
