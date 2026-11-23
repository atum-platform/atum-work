/** Internal relay instances remain configured but have no user-facing settings row. */
export function isProviderSettingsVisible(instance: { readonly showInPicker?: boolean }): boolean {
  return instance.showInPicker !== false
}
