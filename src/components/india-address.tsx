"use client";

import { useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/form";
import { INDIA_STATES, citiesForState } from "@/lib/india-geo";

/** Keeps a legacy/free-text value selectable by adding it to the option list. */
function withCurrent(options: string[], current: string): string[] {
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

/**
 * State + dependent City selector. State is a dropdown of Indian states / UTs;
 * City options come from the chosen state, with an "Other" escape hatch that
 * reveals a free-text input for villages / unlisted towns.
 */
export function StateCityFields({
  state,
  city,
  disabled,
  onStateChange,
  onCityChange,
}: {
  state: string;
  city: string;
  disabled?: boolean;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
}) {
  const cityList = useMemo(() => citiesForState(state), [state]);
  const stateOptions = useMemo(() => withCurrent(INDIA_STATES, state), [state]);
  const [customCity, setCustomCity] = useState(
    () => city.trim() !== "" && !citiesForState(state).includes(city)
  );

  return (
    <>
      <Field label="State">
        <Select
          disabled={disabled}
          value={state}
          onChange={(e) => {
            setCustomCity(false);
            onStateChange(e.target.value);
            onCityChange("");
          }}
        >
          <option value="">Select state</option>
          {stateOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="City">
        {customCity ? (
          <div>
            <Input
              disabled={disabled}
              value={city}
              placeholder="Type city / village"
              onChange={(e) => onCityChange(e.target.value)}
            />
            <button
              type="button"
              disabled={disabled}
              className="mt-1 text-[11px] font-medium text-emerald-600 hover:underline disabled:text-zinc-400"
              onClick={() => {
                setCustomCity(false);
                onCityChange("");
              }}
            >
              Choose from list instead
            </button>
          </div>
        ) : (
          <Select
            disabled={disabled || !state}
            value={city}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__other__") {
                setCustomCity(true);
                onCityChange("");
              } else {
                onCityChange(v);
              }
            }}
          >
            <option value="">{state ? "Select city" : "Select state first"}</option>
            {withCurrent(cityList, city).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other__">Other (type manually)</option>
          </Select>
        )}
      </Field>
    </>
  );
}
