-- Chat image attachments: public URL stored on chat_messages + Storage bucket `chat-images`.

alter table public.chat_messages add column if not exists image_url text;

alter table public.chat_messages alter column message drop not null;

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(
      coalesce(
        nullif(trim(coalesce(new.message, '')), ''),
        case
          when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
          else null
        end,
        ''
      ),
      200
    ),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

create or replace function public.notify_recipient_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip uuid;
  c record;
  body_text text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.sender_id = c.buyer_id then
    recip := c.seller_id;
  elsif new.sender_id = c.seller_id then
    recip := c.buyer_id;
  else
    return new;
  end if;

  body_text := left(
    coalesce(
      nullif(trim(coalesce(new.message, '')), ''),
      case
        when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
        else null
      end,
      'New message'
    ),
    200
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recip,
    'message',
    'New message',
    body_text,
    jsonb_build_object(
      'conversation_id', new.conversation_id::text,
      'message_id', new.id::text,
      'sender_id', new.sender_id::text
    )
  );

  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "Chat images are publicly readable" on storage.objects;
create policy "Chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "Authenticated users can upload chat images" on storage.objects;
create policy "Authenticated users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');
