import { supabase, parseSupabaseError } from './supabase';
import { BrokerProfile, City, BrokerTier } from '../types';

export const brokerService = {
  // Create broker profile
  async createProfile(
    userId: string,
    companyName: string,
    license?: string,
    phone?: string,
    website?: string
  ) {
    try {
      const { data, error } = await supabase
        .from('broker_profiles')
        .insert({
          user_id: userId,
          company_name: companyName,
          license_number: license,
          phone,
          website,
          tier: 'Premium Annual', // Default tier before payment
          selected_cities: [],
          email_enabled: true,
          push_enabled: true,
          sms_enabled: false,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, profile: data as BrokerProfile };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get broker profile
  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('broker_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        return { success: true, profile: null };
      }

      if (error) throw error;

      return { success: true, profile: data as BrokerProfile };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Update broker profile
  async updateProfile(userId: string, updates: Partial<BrokerProfile>) {
    try {
      const { data, error } = await supabase
        .from('broker_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, profile: data as BrokerProfile };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get all cities with founder counts
  async getCities() {
    try {
      // Group by country before sorting by name. With more than one market
      // seeded, a plain name sort interleaves them (Austin, Bacolod, Baguio,
      // Caloocan, Charlotte...), which makes the picker hard to scan.
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('country', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      return { success: true, cities: data as City[] };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get cities filtered by country
  async getCitiesByCountry(country: string) {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('country', country)
        .order('name', { ascending: true });

      if (error) throw error;

      return { success: true, cities: data as City[] };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Search cities by name
  async searchCities(query: string, country?: string) {
    try {
      let queryBuilder = supabase
        .from('cities')
        .select('*')
        .ilike('name', `%${query}%`);

      if (country) {
        queryBuilder = queryBuilder.eq('country', country);
      }

      const { data, error } = await queryBuilder.order('name', { ascending: true });

      if (error) throw error;

      return { success: true, cities: data as City[] };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Check if a city has reached founder cap (30 per city max)
  async checkFounderCapacity(cityId: string): Promise<{ available: boolean; count: number }> {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('founder_count_lifetime')
        .eq('id', cityId)
        .single();

      if (error) throw error;

      const count = data.founder_count_lifetime || 0;
      const available = count < 30;

      return { available, count };
    } catch (error) {
      console.error('Error checking founder capacity:', error);
      return { available: false, count: 0 };
    }
  },

  // Validate city selection based on tier
  async validateCitySelection(
    tier: BrokerTier,
    cityIds: string[]
  ): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const tierCities: Record<BrokerTier, number> = {
      'Founder Lifetime': 25,
      'Premium Annual': 10,
      'Basic Annual': 1,
    };

    const errors: string[] = [];

    // Check city count limit
    if (cityIds.length > tierCities[tier]) {
      errors.push(`${tier} tier allows up to ${tierCities[tier]} cities. You selected ${cityIds.length}.`);
    }

    // Check founder cap for each city (only for Lifetime)
    if (tier === 'Founder Lifetime') {
      for (const cityId of cityIds) {
        const { available, count } = await this.checkFounderCapacity(cityId);
        if (!available) {
          // Get city name for error message
          const { data: city } = await supabase
            .from('cities')
            .select('name')
            .eq('id', cityId)
            .single();

          errors.push(
            `${city?.name || 'City'} has reached the maximum of 30 Founder members (current: ${count}). Choose another city.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Update broker's selected cities
  async updateCities(userId: string, tier: BrokerTier, cityIds: string[]) {
    try {
      // Validate selection
      const validation = await this.validateCitySelection(tier, cityIds);

      if (!validation.valid) {
        return {
          success: false,
          error: {
            message: validation.errors.join('; '),
            code: 'INVALID_CITY_SELECTION',
          },
        };
      }

      // Update profile
      const { data, error } = await supabase
        .from('broker_profiles')
        .update({
          selected_cities: cityIds,
          tier,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, profile: data as BrokerProfile };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get marketing budget allocation for broker's cities
  async getMarketingAllocation(userId: string) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('broker_profiles')
        .select('selected_cities')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      const cityIds = profile.selected_cities || [];

      if (cityIds.length === 0) {
        return { success: true, allocations: [] };
      }

      // Get current month's allocation
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthDate = monthStart.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('marketing_allocations')
        .select('*, city:city_id(name)')
        .eq('allocation_month', monthDate)
        .in('city_id', cityIds);

      if (error) throw error;

      return { success: true, allocations: data };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Update notification preferences
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      email_enabled?: boolean;
      push_enabled?: boolean;
      sms_enabled?: boolean;
      quiet_hours_start?: string;
      quiet_hours_end?: string;
    }
  ) {
    try {
      const { data, error } = await supabase
        .from('broker_profiles')
        .update(preferences)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, profile: data as BrokerProfile };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get public broker profile by ID (for Find a Pro page)
  async getPublicProfile(brokerId: string) {
    try {
      const { data, error } = await supabase
        .from('broker_profiles')
        .select(
          `
          id,
          company_name,
          bio,
          profile_photo_url,
          phone,
          website,
          tier,
          founded:subscriptions(started_at),
          user:user_id(email)
        `
        )
        .eq('user_id', brokerId)
        .single();

      if (error && error.code === 'PGRST116') {
        return { success: true, profile: null };
      }

      if (error) throw error;

      return { success: true, profile: data };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  /**
   * Route a newly created lead to every currently-paying broker subscribed to
   * its city.
   *
   * This has to go through the route_lead_to_brokers Postgres function
   * (migration 008) rather than querying broker_profiles/subscriptions
   * directly: matching a lead's city against brokers means reading OTHER
   * users' selected_cities and subscription status, and a consumer's own RLS
   * session correctly can't do that — those tables are scoped to "a broker
   * sees only their own row". Verified live: the same queries this function
   * used to run directly returned HTTP 200 with an empty array under a real
   * consumer session, even though a matching broker existed — RLS silently
   * filters rows rather than erroring, so that version would have looked like
   * "no brokers in this city" forever. The RPC runs the matching + insert
   * SECURITY DEFINER, server-side, in one call.
   *
   * Deliberately separate from searchBrokersByCity below: that method returns
   * every broker who selected a city, for a public directory-type view. This
   * one gates on an active subscription, because it is the step that actually
   * hands a paying customer's data to a broker — an unpaid or lapsed broker
   * must not receive it. That gating lives in the SQL function, not here.
   */
  async routeLeadToBrokers(leadId: string, cityId: string | null) {
    if (!cityId) {
      return { success: true, routedCount: 0 };
    }

    try {
      const { data, error } = await supabase.rpc('route_lead_to_brokers', {
        p_lead_id: leadId,
        p_city_id: cityId,
      });

      if (error) throw error;

      return { success: true, routedCount: (data as number) ?? 0 };
    } catch (error) {
      console.error('Error routing lead to brokers:', error);
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Search public brokers by city
  async searchBrokersByCity(cityId: string, tier?: BrokerTier) {
    try {
      let query = supabase
        .from('broker_profiles')
        .select(
          `
          id,
          user_id,
          company_name,
          bio,
          profile_photo_url,
          tier,
          selected_cities
        `
        )
        .contains('selected_cities', [cityId]);

      if (tier) {
        query = query.eq('tier', tier);
      }

      const { data, error } = await query.order('tier', {
        ascending: false,
      });

      if (error) throw error;

      return { success: true, brokers: data };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },
};
