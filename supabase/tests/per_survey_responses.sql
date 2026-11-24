-- Run against a disposable database with all migrations applied and pgTAP available.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

set local role service_role;
select survey_admin.create_survey('alpha_test');
select survey_admin.create_survey('alpha_test');
select survey_admin.create_survey('beta_test');
select survey_admin.create_survey('closed_test');
select survey_admin.create_survey('expired_test');
select survey_admin.create_survey('haztartasi_rugalmassag');

do $$
begin
  begin
    perform survey_admin.create_survey('INVALID slug');
    raise exception 'create_survey accepted an invalid slug';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
update survey_admin.surveys set accepting_responses = true,
  retention_until = (statement_timestamp() at time zone 'UTC')::date + 1,
  paradata = slug = 'beta_test' where slug in ('alpha_test', 'beta_test');
update survey_admin.surveys set paradata = true,
  retention_until = (statement_timestamp() at time zone 'UTC')::date + 1
  where slug in ('closed_test', 'haztartasi_rugalmassag');
update survey_admin.surveys set accepting_responses = true, paradata = true,
  retention_until = (statement_timestamp() at time zone 'UTC')::date - 1 where slug = 'expired_test';

set local role anon;
select public.submit_response('alpha_test', 'same-receipt', '{"sessionId":"same-receipt","completed":true,"consent":{"participation":true,"paradata":true},"paradata":{"N01":{}}}');
select public.submit_response('alpha_test', 'same-receipt', '{"completed":true,"consent":{"participation":true}}');
select public.submit_response('beta_test', 'same-receipt', '{"completed":true,"consent":{"participation":true,"paradata":true},"paradata":{"N02":{}}}');

do $$
declare
  s text;
begin
  if public.survey_response_count('alpha_test') <> 1 or public.survey_response_count('beta_test') <> 1
    or public.survey_response_count('closed_test') <> 0 or public.survey_response_count('missing_test') is not null then
    raise exception 'Unexpected response count';
  end if;

  foreach s in array array['INVALID slug', 'missing_test', 'closed_test'] loop
    begin
      perform public.submit_response(s, 'receipt', '{"completed":true,"consent":{"participation":true}}');
      raise exception 'submit_response accepted inactive or invalid slug %', s;
    exception when invalid_parameter_value then null;
    end;
  end loop;

  begin
    perform public.submit_response('alpha_test', 'large-receipt',
      jsonb_build_object('completed', true, 'consent', '{"participation":true}'::jsonb, 'large', repeat('a', 262145)));
    raise exception 'submit_response accepted an oversized payload';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.submit_response('alpha_test', 'no-consent', '{"completed":true,"consent":{"participation":false}}');
    raise exception 'submit_response accepted a response without participation consent';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform 1 from survey_data.responses;
    raise exception 'anon read the partitioned parent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from survey_data.responses_alpha_test;
    raise exception 'anon read a partition';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.export_survey_responses('alpha_test');
    raise exception 'anon exported responses';
  exception when insufficient_privilege then null;
  end;
  begin
    perform survey_admin.create_survey('anon_test');
    raise exception 'anon created a survey';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select throws_ok(
  $$select public.submit_survey_metrics('missing_test', 'receipt', 'test', 'kozepes', 60, null, 'not_shown', null, null, null)$$,
  '22023', 'Survey does not accept metrics', 'metrics require a registered survey'
);
select throws_ok(
  $$select public.submit_survey_metrics('closed_test', 'receipt', 'test', 'kozepes', 60, null, 'not_shown', null, null, null)$$,
  '22023', 'Survey does not accept metrics', 'closed surveys reject metrics'
);
select throws_ok(
  $$select public.submit_survey_metrics('expired_test', 'receipt', 'test', 'kozepes', 60, null, 'not_shown', null, null, null)$$,
  '22023', 'Survey does not accept metrics', 'expired surveys reject metrics'
);
select throws_ok(
  $$select public.submit_survey_metrics('alpha_test', 'receipt', 'test', 'kozepes', 60, null, 'not_shown', null, null, null)$$,
  '22023', 'Survey does not accept metrics', 'metrics require paradata to be enabled'
);
select throws_ok(
  $$insert into survey_private.completions (receipt, bank_version, effort, reaction_status)
    values (decode('00', 'hex'), 'test', 'kozepes', 'not_shown')$$,
  '42501', null, 'anon cannot insert metrics directly'
);
select ok(not has_table_privilege('anon', 'survey_private.completions', 'INSERT'), 'anon lacks INSERT on completions');
select ok(not has_table_privilege('authenticated', 'survey_private.completions', 'INSERT'), 'authenticated lacks INSERT on completions');
select throws_ok(
  $$select public.submit_survey_completion('receipt', 'test', 'kozepes', 60, 'drag', 'answered', 'drag', 100, 5::smallint)$$,
  '22023', 'Survey does not accept metrics', 'the legacy RPC respects the default survey closure'
);

reset role;
update survey_admin.surveys set accepting_responses = true where slug = 'haztartasi_rugalmassag';
set local role anon;
select public.submit_survey_completion('legacy-' || n, 'test', 'kozepes', 60, 'drag',
  'answered', 'drag', 100, 5::smallint) from generate_series(1, 5) n;
select public.submit_survey_metrics('beta_test', 'scoped-' || n, 'test', 'kozepes', 120, null,
  'not_shown', null, null, null) from generate_series(1, 5) n;
select public.submit_survey_completion('no-rating', 'test', 'kozepes', 60, 'tap',
  'answered', 'tap', 200);
select public.submit_survey_metrics('beta_test', 'no-rating', 'test', 'kozepes', 120, 'drag',
  'skipped', null, null);

do $$
begin
  if (select median_minutes from public.survey_effort_medians('test')) is distinct from 1::numeric
    or (select median_minutes from public.survey_effort_medians('beta_test', 'test')) is distinct from 2::numeric then
    raise exception 'Metrics aggregated across surveys or lost legacy rows';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  payload_a jsonb;
  payload_b jsonb;
begin
  select payload into strict payload_a from public.export_survey_responses('alpha_test');
  select payload into strict payload_b from public.export_survey_responses('beta_test');
  if payload_a ? 'sessionId' or payload_a ? 'paradata' or payload_a #> '{consent,paradata}' is distinct from 'false'::jsonb
    or not (payload_b ? 'paradata') then
    raise exception 'Unexpected paradata or raw receipt in the exported payload';
  end if;
end;
$$;

reset role;
select ok((select count(*) = 5 and min(use_again) = 5 from survey_private.completions
  where bank_version = 'test' and use_again is not null), 'legacy ratings are retained');
select ok((select count(*) = 2 from survey_private.completions
  where bank_version = 'test' and arm is not null and use_again is null), 'both RPCs accept omitted ratings');
select ok((select answered = 1 and used_tap = 1 and used_drag = 0 and median_first_answer_ms = 200
  from survey_private.temperature_ab where survey_slug = 'haztartasi_rugalmassag'
    and bank_version = 'test' and arm = 'tap'), 'temperature view reports behavioural outcomes');
select ok(not exists (select from information_schema.columns
  where table_schema = 'survey_private' and table_name = 'temperature_ab'
    and column_name in ('rated_use_again', 'willing_to_use_again')), 'temperature view omits self-reported ratings');

update survey_admin.surveys set retention_until = (statement_timestamp() at time zone 'UTC')::date - 1 where slug = 'alpha_test';
set local role anon;
do $$
begin
  begin
    perform public.submit_response('alpha_test', 'expired-receipt', '{"completed":true,"consent":{"participation":true}}');
    raise exception 'submit_response accepted an expired survey';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select * from finish();
rollback;
