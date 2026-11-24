begin;

alter table survey_data.responses
  alter column received_at drop default,
  alter column received_at type date using (received_at at time zone 'UTC')::date;
alter table survey_data.responses rename column received_at to received_on;
alter table survey_data.responses
  alter column received_on set default (statement_timestamp() at time zone 'UTC')::date;

-- Recreate the RPC because PostgreSQL cannot replace its return type in place.
drop function public.export_survey_responses(text, text, integer);
create function public.export_survey_responses(slug text, after_receipt text default null, page_size integer default 200)
returns table (receipt_hash text, received_on date, payload jsonb)
language sql stable security invoker set search_path = '' as $$
  select encode(r.receipt_hash, 'hex'), r.received_on, r.payload
  from survey_data.responses r
  where r.survey_slug = slug and (after_receipt is null or r.receipt_hash > decode(after_receipt, 'hex'))
  order by r.receipt_hash
  limit greatest(1, least(page_size, 500))
$$;

revoke all on function public.export_survey_responses(text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.export_survey_responses(text, text, integer) to service_role;

commit;
