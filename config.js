// RenewCast AI — shared config
const API_BASE = "http://127.0.0.1:5000/api";

// Appliance catalog (mirrors backend)
const APPLIANCE_CATALOG = {
    lights        : { label: "LED Lights (10 bulbs)",  watts: 100,  icon: "💡" },
    fan           : { label: "Ceiling Fan",             watts: 75,   icon: "🌀" },
    fridge        : { label: "Refrigerator",            watts: 150,  icon: "🧊" },
    tv            : { label: 'LED TV (43")',            watts: 80,   icon: "📺" },
    ac            : { label: "Air Conditioner (1.5T)",  watts: 1500, icon: "❄️" },
    washing_machine:{ label: "Washing Machine",         watts: 500,  icon: "🫧" },
    microwave     : { label: "Microwave Oven",          watts: 900,  icon: "🍲" },
    geyser        : { label: "Water Heater / Geyser",  watts: 2000, icon: "🚿" },
    computer      : { label: "Desktop Computer",        watts: 200,  icon: "🖥️" },
    pump          : { label: "Water Pump",              watts: 750,  icon: "💧" },
};
