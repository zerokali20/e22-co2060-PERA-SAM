import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Filter, 
  Search, 
  Star, 
  Phone, 
  MessageSquare,
  Calendar,
  ChevronRight,
  Laptop,
  Server,
  Car,
  Settings,
  Wind,
  Factory
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const serviceCategories = [
  { id: 'all', label: 'All Services', icon: Settings },
  { id: 'laptop', label: 'Laptop/PC', icon: Laptop },
  { id: 'server', label: 'Servers', icon: Server },
  { id: 'vehicle', label: 'Vehicles', icon: Car },
  { id: 'hvac', label: 'HVAC', icon: Wind },
  { id: 'industrial', label: 'Industrial', icon: Factory },
];

// Demo service providers
const serviceProviders = [
  {
    id: '1',
    name: 'TechRepair Pro',
    address: '456 Service Ave, San Francisco, CA',
    rating: 4.8,
    reviews: 127,
    phone: '+1 555-0456',
    categories: ['laptop', 'server'],
    distance: '0.8 mi',
    available: true,
    lat: 37.7749,
    lng: -122.4194,
  },
  {
    id: '2',
    name: 'AutoSound Diagnostics',
    address: '789 Motor Blvd, San Francisco, CA',
    rating: 4.6,
    reviews: 89,
    phone: '+1 555-0789',
    categories: ['vehicle'],
    distance: '1.2 mi',
    available: true,
    lat: 37.7849,
    lng: -122.4094,
  },
  {
    id: '3',
    name: 'Industrial Systems Inc.',
    address: '321 Factory Lane, Oakland, CA',
    rating: 4.9,
    reviews: 203,
    phone: '+1 555-0321',
    categories: ['industrial', 'hvac'],
    distance: '3.5 mi',
    available: false,
    lat: 37.8044,
    lng: -122.2712,
  },
  {
    id: '4',
    name: 'Quick PC Solutions',
    address: '555 Tech Street, San Jose, CA',
    rating: 4.4,
    reviews: 56,
    phone: '+1 555-0555',
    categories: ['laptop', 'server'],
    distance: '4.2 mi',
    available: true,
    lat: 37.3382,
    lng: -121.8863,
  },
  {
    id: '5',
    name: 'HVAC Masters',
    address: '888 Climate Way, Palo Alto, CA',
    rating: 4.7,
    reviews: 145,
    phone: '+1 555-0888',
    categories: ['hvac'],
    distance: '5.1 mi',
    available: true,
    lat: 37.4419,
    lng: -122.1430,
  },
];

export const MapPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const filteredProviders = serviceProviders.filter(provider => {
    const matchesCategory = selectedCategory === 'all' || provider.categories.includes(selectedCategory);
    const matchesSearch = provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         provider.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (categoryId: string) => {
    const category = serviceCategories.find(c => c.id === categoryId);
    return category?.icon || Settings;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Find Service Providers</h1>
        <p className="text-muted-foreground mt-1">
          Locate certified technicians and repair services near you
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by service" />
          </SelectTrigger>
          <SelectContent>
            {serviceCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {serviceCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat.id
                ? 'bg-accent text-accent-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <cat.icon className="h-4 w-4" />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Map View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl overflow-hidden h-[500px] lg:h-[600px]"
        >
          {/* Placeholder Map */}
          <div className="relative w-full h-full bg-muted">
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50">
              {/* Map background pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
                {[...Array(10)].map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="currentColor" strokeWidth="0.5" />
                ))}
                {[...Array(10)].map((_, i) => (
                  <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="currentColor" strokeWidth="0.5" />
                ))}
              </svg>
            </div>

            {/* Map Markers */}
            {filteredProviders.map((provider, index) => (
              <motion.button
                key={provider.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedProvider(provider.id)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                  selectedProvider === provider.id ? 'z-20' : 'z-10'
                }`}
                style={{
                  left: `${20 + index * 15}%`,
                  top: `${30 + (index % 3) * 20}%`,
                }}
              >
                <div className={`relative ${selectedProvider === provider.id ? 'scale-125' : ''} transition-transform`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                    provider.available ? 'bg-accent text-accent-foreground' : 'bg-muted-foreground text-muted'
                  }`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  {selectedProvider === provider.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-12 left-1/2 -translate-x-1/2 bg-card shadow-lg rounded-lg p-3 min-w-48 text-left"
                    >
                      <p className="font-semibold text-foreground text-sm">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.distance} away</p>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            ))}

            {/* Current Location Marker */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <div className="relative">
                <div className="w-4 h-4 bg-info rounded-full animate-ping absolute" />
                <div className="w-4 h-4 bg-info rounded-full border-2 border-white" />
              </div>
            </div>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button variant="secondary" size="icon" className="bg-card shadow-md">
                <span className="text-lg font-bold">+</span>
              </Button>
              <Button variant="secondary" size="icon" className="bg-card shadow-md">
                <span className="text-lg font-bold">−</span>
              </Button>
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
              <p className="text-xs font-medium text-foreground mb-2">Legend</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-accent rounded-full" />
                  <span className="text-xs text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-muted-foreground rounded-full" />
                  <span className="text-xs text-muted-foreground">Busy</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-info rounded-full" />
                  <span className="text-xs text-muted-foreground">You</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Provider List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredProviders.length} service providers found
            </p>
          </div>

          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2">
            {filteredProviders.map((provider, index) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedProvider(provider.id)}
                className={`glass-card rounded-xl p-5 cursor-pointer transition-all hover:shadow-card-hover ${
                  selectedProvider === provider.id ? 'ring-2 ring-accent' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    provider.available ? 'bg-accent/10' : 'bg-muted'
                  }`}>
                    <MapPin className={`h-6 w-6 ${provider.available ? 'text-accent' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{provider.name}</h3>
                      {provider.available ? (
                        <span className="px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">Available</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">Busy</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{provider.address}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-warning fill-warning" />
                        <span className="text-sm font-medium">{provider.rating}</span>
                        <span className="text-xs text-muted-foreground">({provider.reviews})</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{provider.distance}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {provider.categories.map((catId) => {
                        const Icon = getCategoryIcon(catId);
                        const category = serviceCategories.find(c => c.id === catId);
                        return (
                          <span 
                            key={catId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full"
                          >
                            <Icon className="h-3 w-3" />
                            {category?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>

                {selectedProvider === provider.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-border"
                  >
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="accent" className="flex-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        Book Appointment
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Message
                      </Button>
                      <Button variant="secondary" size="icon">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}

            {filteredProviders.length === 0 && (
              <div className="glass-card rounded-xl p-12 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No service providers found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
