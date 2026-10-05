import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorUiStore } from './editor-ui-store'

describe('useEditorUiStore catalog feature filters', () => {
  beforeEach(() => {
    useEditorUiStore.setState({ catalogFeatureFilters: [] })
  })

  it('starts with no feature filter selected', () => {
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual([])
  })

  it('adds a key that is absent and removes one that is present', () => {
    const { toggleCatalogFeatureFilter } = useEditorUiStore.getState()
    toggleCatalogFeatureFilter('built-in-mic')
    toggleCatalogFeatureFilter('outdoor-rated')
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual(['built-in-mic', 'outdoor-rated'])

    toggleCatalogFeatureFilter('built-in-mic')
    expect(useEditorUiStore.getState().catalogFeatureFilters).toEqual(['outdoor-rated'])
  })

  it('replaces the array instead of mutating it', () => {
    const before = useEditorUiStore.getState().catalogFeatureFilters
    useEditorUiStore.getState().toggleCatalogFeatureFilter('human-detection')
    expect(useEditorUiStore.getState().catalogFeatureFilters).not.toBe(before)
    expect(before).toEqual([])
  })
})
