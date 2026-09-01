-- Digital Aastraa public-site security hardening.
-- Run once in Supabase Dashboard > SQL Editor before publishing the repository.
-- Safe to re-run. Existing enquiries and administrator accounts are preserved.

create or replace function public.submit_contact(
    p_name text,
    p_phone text,
    p_email text,
    p_service text,
    p_newsletter boolean,
    p_project_description text,
    p_enquiry_type text,
    p_lead_source text,
    p_utm_source text,
    p_utm_medium text,
    p_utm_campaign text,
    p_landing_page text,
    p_referrer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    clean_name text := trim(coalesce(p_name, ''));
    clean_phone text := trim(coalesce(p_phone, ''));
    clean_email text := lower(trim(coalesce(p_email, '')));
    clean_service text := trim(coalesce(p_service, ''));
    clean_description text := trim(coalesce(p_project_description, ''));
    clean_type text := lower(trim(coalesce(p_enquiry_type, 'contact')));
    clean_source text := trim(coalesce(p_lead_source, 'Website'));
    recent_submissions integer;
    new_submission_id uuid;
begin
    if char_length(clean_name) not between 2 and 120 then
        raise exception 'Please enter a valid name.' using errcode = '22023';
    end if;
    if char_length(clean_phone) not between 7 and 24
        or clean_phone !~ '^[0-9+() -]+$' then
        raise exception 'Please enter a valid phone number.' using errcode = '22023';
    end if;
    if char_length(clean_email) not between 5 and 254
        or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Please enter a valid email address.' using errcode = '22023';
    end if;
    if char_length(clean_service) not between 2 and 80 then
        raise exception 'Please select a valid service.' using errcode = '22023';
    end if;
    if char_length(clean_description) > 5000 then
        raise exception 'The project description is too long.' using errcode = '22023';
    end if;
    if clean_type not in ('contact', 'audit') then
        raise exception 'Invalid enquiry type.' using errcode = '22023';
    end if;
    if char_length(clean_source) not between 1 and 120
        or char_length(coalesce(p_utm_source, '')) > 160
        or char_length(coalesce(p_utm_medium, '')) > 160
        or char_length(coalesce(p_utm_campaign, '')) > 240
        or char_length(coalesce(p_landing_page, '')) > 1000
        or char_length(coalesce(p_referrer, '')) > 1000 then
        raise exception 'Invalid attribution data.' using errcode = '22023';
    end if;

    -- Serialize duplicate requests and allow at most three per email or phone each hour.
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(clean_email || '|' || clean_phone, 0)
    );
    select count(*) into recent_submissions
    from public.contact_submissions
    where created_at > now() - interval '1 hour'
      and (lower(email) = clean_email or phone = clean_phone);

    if recent_submissions >= 3 then
        raise exception 'Too many requests. Please try again later.' using errcode = 'P0001';
    end if;

    insert into public.contact_submissions (
        name, phone, email, service, newsletter, project_description,
        enquiry_type, lead_source, utm_source, utm_medium, utm_campaign,
        landing_page, referrer, status, admin_notes, estimated_value
    ) values (
        clean_name, clean_phone, clean_email, clean_service, coalesce(p_newsletter, false),
        clean_description, clean_type, clean_source, nullif(trim(coalesce(p_utm_source, '')), ''),
        nullif(trim(coalesce(p_utm_medium, '')), ''), nullif(trim(coalesce(p_utm_campaign, '')), ''),
        nullif(trim(coalesce(p_landing_page, '')), ''), nullif(trim(coalesce(p_referrer, '')), ''),
        'new', '', 0
    )
    returning id into new_submission_id;

    return new_submission_id;
end;
$$;

revoke all on function public.submit_contact(
    text, text, text, text, boolean, text, text, text,
    text, text, text, text, text
) from public;
grant execute on function public.submit_contact(
    text, text, text, text, boolean, text, text, text,
    text, text, text, text, text
) to anon, authenticated;

-- Visitors must use the validated function; they can no longer insert arbitrary rows.
revoke insert on table public.contact_submissions from anon, authenticated;
drop policy if exists "Visitors can submit contact forms" on public.contact_submissions;

notify pgrst, 'reload schema';
