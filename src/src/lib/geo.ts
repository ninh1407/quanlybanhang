
// Haversine formula to calculate distance between two points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

// Mock geocoding for Vietnam major cities
const cityCoords: Record<string, { lat: number; lng: number }> = {
    'hà nội': { lat: 21.0285, lng: 105.8542 },
    'ho chi minh': { lat: 10.8231, lng: 106.6297 },
    'hồ chí minh': { lat: 10.8231, lng: 106.6297 },
    'tphcm': { lat: 10.8231, lng: 106.6297 },
    'sài gòn': { lat: 10.8231, lng: 106.6297 },
    'đà nẵng': { lat: 16.0544, lng: 108.2022 },
    'hải phòng': { lat: 20.8449, lng: 106.6881 },
    'cần thơ': { lat: 10.0452, lng: 105.7469 },
    'nghệ an': { lat: 19.2342, lng: 104.8957 },
    'đồng nai': { lat: 10.9423, lng: 106.8244 },
    'bình dương': { lat: 11.1667, lng: 106.65 },
    'thanh hóa': { lat: 19.8077, lng: 105.7765 },
    'khánh hòa': { lat: 12.2388, lng: 109.1967 },
    'nha trang': { lat: 12.2388, lng: 109.1967 },
    'lâm đồng': { lat: 11.9404, lng: 108.4583 },
    'đà lạt': { lat: 11.9404, lng: 108.4583 },
    'bà rịa': { lat: 10.4963, lng: 107.1685 },
    'vũng tàu': { lat: 10.3460, lng: 107.0843 },
    'quảng ninh': { lat: 20.9500, lng: 107.0733 },
    'hạ long': { lat: 20.9500, lng: 107.0733 },
    'bắc ninh': { lat: 21.1861, lng: 106.0763 },
    'hải dương': { lat: 20.9390, lng: 106.3113 },
    'hưng yên': { lat: 20.6464, lng: 106.0511 },
    'nam định': { lat: 20.4173, lng: 106.1685 },
    'thái bình': { lat: 20.4461, lng: 106.3366 },
    'vĩnh phúc': { lat: 21.3093, lng: 105.6046 },
    'phú thọ': { lat: 21.3225, lng: 105.2280 },
    'thái nguyên': { lat: 21.5672, lng: 105.8247 },
    'bắc giang': { lat: 21.2731, lng: 106.1947 },
    'quảng nam': { lat: 15.5684, lng: 108.0163 },
    'hội an': { lat: 15.8801, lng: 108.3380 },
    'quảng ngãi': { lat: 15.1205, lng: 108.7923 },
    'bình định': { lat: 13.7830, lng: 109.2197 },
    'quy nhơn': { lat: 13.7830, lng: 109.2197 },
    'phú yên': { lat: 13.0882, lng: 109.0924 },
    'bình thuận': { lat: 11.0963, lng: 108.0827 },
    'phan thiết': { lat: 10.9289, lng: 108.1021 },
    'long an': { lat: 10.5364, lng: 106.4116 },
    'tiền giang': { lat: 10.4309, lng: 106.3686 },
    'bến tre': { lat: 10.2435, lng: 106.3758 },
    'vĩnh long': { lat: 10.2541, lng: 105.9723 },
    'đồng tháp': { lat: 10.4571, lng: 105.6325 },
    'an giang': { lat: 10.5284, lng: 105.1259 },
    'kiên giang': { lat: 10.0132, lng: 105.0809 },
    'phú quốc': { lat: 10.2289, lng: 103.9572 },
    'hà giang': { lat: 22.8233, lng: 104.9839 },
    'lào cai': { lat: 22.4808, lng: 103.9737 },
    'sapa': { lat: 22.3364, lng: 103.8438 },
};

export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const mock = mockGeocode(address);
    if (mock) return mock;

    try {
        // Use OpenStreetMap Nominatim API
        // Note: Needs strict User-Agent. 
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'SalesAdminWebApp/1.0' 
            }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (e) {
        console.error('Geocoding failed', e);
    }
    return null;
}

export function mockGeocode(address: string): { lat: number; lng: number } | null {
    if (!address) return null;
    const lower = address.toLowerCase();
    
    // Check if address is coordinates "lat,lng"
    const coords = lower.split(',').map(s => s.trim());
    if (coords.length === 2) {
        const lat = Number(coords[0]);
        const lng = Number(coords[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }

    // Sort cities by name length desc to match longest first (e.g. "Hồ Chí Minh" before "Hồ")
    const sortedCities = Object.keys(cityCoords).sort((a, b) => b.length - a.length);

    // Check for city name in address
    for (const city of sortedCities) {
        if (lower.includes(city)) {
            return cityCoords[city];
        }
    }
    
    return null;
}
