const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jsbymonfkasdhnfvkrrx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nJ_aHTgcE53yM01NxmPLcw_wRzSYzGx';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
