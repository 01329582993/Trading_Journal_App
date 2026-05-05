import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dgctvunkbuvbmpqroedm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ruKBFdtiMEWzR-R3RD8Obw_Cz25krqU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
