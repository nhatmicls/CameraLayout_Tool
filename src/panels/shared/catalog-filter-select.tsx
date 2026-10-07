interface CatalogFilterSelectOption {
  value: string
  label: string
}

interface CatalogFilterSelectGroup {
  /** `<optgroup>` label, e.g. "Placed in this project" / "Not placed". Omitted entirely when `options` is empty - an empty `<optgroup>` never renders. */
  label: string
  options: readonly CatalogFilterSelectOption[]
}

interface CatalogFilterSelectProps {
  label: string
  testId: string
  value: string
  /** Flat options after the leading "All" entry. Ignored when `groups` is given. */
  options?: readonly CatalogFilterSelectOption[]
  /** Grouped options rendered as `<optgroup>`s after "All" (e.g. the "works with" controller drop-down's "Placed in this project" / "Not placed" split) - takes priority over `options`. */
  groups?: readonly CatalogFilterSelectGroup[]
  onChange: (value: string) => void
}

/**
 * One labelled drop-down row of a catalog tab's filter block ("Brand",
 * "Type", "Works with"), always starting with an "All" option. Same look as
 * the camera tab's brand / form selects; used by the sensor, fire-alarm and
 * control-panel tabs. `groups` (added for the shared "works with" filter)
 * renders `<optgroup>`s instead of a flat list - an empty group is omitted
 * so a tab with nothing placed yet shows only "Not placed".
 */
export function CatalogFilterSelect({ label, testId, value, options, groups, onChange }: CatalogFilterSelectProps) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 flex-shrink-0 text-neutral-500">{label}</span>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-neutral-300 px-1.5 py-1"
      >
        <option value="all">All</option>
        {groups
          ? groups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))
          : (options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
      </select>
    </label>
  )
}
