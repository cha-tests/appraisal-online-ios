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
      const { data, error } = await supabase
        .from('cities')
        .select('*')
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
