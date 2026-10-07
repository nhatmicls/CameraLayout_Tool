import { describe, expect, it } from 'vitest'
import { VIEW_CAMERA_FORM_FACTORS } from '../../domain/view/view-config-types'
import { FORM_FACTORS } from './camera-catalog-schema'

// `src/domain` cannot import `src/catalog`, so the view config keeps its own form-factor key
// list. This test lives on the catalog side and fails when the two lists drift apart - a new
// catalog form factor without a view toggle could never be hidden.
describe('view config form-factor keys', () => {
  it('hold exactly the catalog form factors', () => {
    expect([...VIEW_CAMERA_FORM_FACTORS].sort()).toEqual([...FORM_FACTORS].sort())
  })
})
