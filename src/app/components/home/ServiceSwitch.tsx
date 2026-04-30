type ServiceType = "shop" | "ride" | "send";

type ServiceSwitchProps = {
  value: ServiceType;
  onChange: (value: ServiceType) => void;
};

const OPTIONS: { id: ServiceType; label: string }[] = [
  { id: "shop", label: "Shop" },
  { id: "ride", label: "Ride" },
  { id: "send", label: "Send" },
];

export default function ServiceSwitch({ value, onChange }: ServiceSwitchProps) {
  return (
    <div className="mb-4">
      <div className="flex w-full gap-2 overflow-x-auto rounded-xl bg-white p-1.5">
        {OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[#22c55e] text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
