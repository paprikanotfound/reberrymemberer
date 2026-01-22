
// Helper function to get country from timezone
export function getCountryFromTimezone(): string | undefined {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Map timezones to country codes (ISO 3166-1 alpha-2)
    const timezoneToCountry: Record<string, string> = {
      // North America
      'America/New_York': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Los_Angeles': 'US',
      'America/Phoenix': 'US',
      'America/Anchorage': 'US',
      'America/Honolulu': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'America/Edmonton': 'CA',
      'America/Mexico_City': 'MX',

      // Europe
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'Europe/Amsterdam': 'NL',
      'Europe/Brussels': 'BE',
      'Europe/Vienna': 'AT',
      'Europe/Zurich': 'CH',
      'Europe/Stockholm': 'SE',
      'Europe/Copenhagen': 'DK',
      'Europe/Oslo': 'NO',
      'Europe/Helsinki': 'FI',
      'Europe/Warsaw': 'PL',
      'Europe/Prague': 'CZ',
      'Europe/Budapest': 'HU',
      'Europe/Athens': 'GR',
      'Europe/Lisbon': 'PT',
      'Europe/Dublin': 'IE',
      'Europe/Moscow': 'RU',

      // Asia
      'Asia/Seoul': 'KR',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG',
      'Asia/Bangkok': 'TH',
      'Asia/Jakarta': 'ID',
      'Asia/Manila': 'PH',
      'Asia/Kuala_Lumpur': 'MY',
      'Asia/Dubai': 'AE',
      'Asia/Kolkata': 'IN',
      'Asia/Karachi': 'PK',
      'Asia/Istanbul': 'TR',
      'Asia/Tel_Aviv': 'IL',

      // Oceania
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
      'Australia/Brisbane': 'AU',
      'Australia/Perth': 'AU',
      'Pacific/Auckland': 'NZ',

      // South America
      'America/Sao_Paulo': 'BR',
      'America/Buenos_Aires': 'AR',
      'America/Santiago': 'CL',
      'America/Lima': 'PE',
      'America/Bogota': 'CO',
    };

    return timezoneToCountry[timezone];
  } catch (e) {
    console.error('Failed to detect country from timezone:', e);
    return undefined;
  }
}
