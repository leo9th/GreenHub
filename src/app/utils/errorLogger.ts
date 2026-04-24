import { supabase } from '../../lib/supabase';

export async function logError(error: Error, context?: Record<string, unknown>) {
  console.error(error, context);

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from('error_logs').insert({
      error_message: error.message,
      stack: error.stack,
      url: window.location.href,
      user_id: user?.id ?? null,
    });

    if (insertError) {
      console.warn('Failed to persist error log:', insertError.message);
    }
  } catch (loggingError) {
    console.warn('Error logging failed:', loggingError);
  }
}
