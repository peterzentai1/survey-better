begin;

-- App versions through bank 0.2.1 can still replay their queued ratings.
create or replace function public.submit_survey_metrics(
  slug text, token text, bank_version text, effort text, active_seconds integer, arm text,
  reaction_status text, first_input text, first_answer_ms integer, use_again smallint default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from survey_admin.surveys s
  where s.slug = submit_survey_metrics.slug and s.accepting_responses and s.paradata
    and s.retention_until >= (statement_timestamp() at time zone 'UTC')::date
  for share;
  if not found then
    raise exception 'Survey does not accept metrics' using errcode = '22023';
  end if;

  insert into survey_private.completions (receipt, bank_version, effort, active_seconds, arm,
    reaction_status, first_input, first_answer_ms, use_again, survey_slug)
  values (sha256(convert_to(case when slug = 'haztartasi_rugalmassag' then token else slug || ':' || token end, 'UTF8')),
    bank_version, effort, active_seconds, arm, reaction_status, first_input, first_answer_ms, use_again, slug)
  on conflict do nothing;
end;
$$;

create or replace function public.submit_survey_completion(
  token text, bank_version text, effort text, active_seconds integer, arm text,
  reaction_status text, first_input text, first_answer_ms integer, use_again smallint default null
) returns void language sql security invoker set search_path = '' as $$
  select public.submit_survey_metrics('haztartasi_rugalmassag', token, bank_version, effort,
    active_seconds, arm, reaction_status, first_input, first_answer_ms, use_again)
$$;

-- PostgreSQL requires recreating a view when removing columns.
drop view survey_private.temperature_ab;
create view survey_private.temperature_ab as
  select bank_version, effort, arm, count(*) as completions,
    count(*) filter (where reaction_status = 'answered') as answered,
    count(*) filter (where reaction_status = 'skipped') as skipped,
    count(*) filter (where first_input = 'drag') as used_drag,
    count(first_answer_ms) as timed_answers,
    percentile_cont(0.5) within group (order by first_answer_ms) as median_first_answer_ms,
    survey_slug,
    count(*) filter (where first_input = 'tap') as used_tap
  from survey_private.completions where arm is not null group by bank_version, effort, arm, survey_slug;
revoke all on survey_private.temperature_ab from public, anon, authenticated, service_role;

commit;
