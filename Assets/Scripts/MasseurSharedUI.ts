/**
 * MasseurSharedUI - shared typography and UIKit composition helpers for the
 * Masseur Mode UI modules (no component of its own).
 *
 * Text size is never a raw number: pick a role and a viewing distance and
 * applyTextRole() sets size + weight from the Specs type scale, scaled so the
 * text keeps the same angular size at 70, 80 or 145 cm.
 * The display is additive (black = transparent), so all text is light.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"

// ── Typography: the single source of truth for text size + weight ──
// size = em-square at 110 cm (Snap Specs type scale, SnapOS system font).
export const FONT_SIZE_SCALE = 1.0
/** Readability boost over the base Specs scale (seated user, additive display, text 70-145 cm away). */
export const TEXT_BOOST = 1.6
/** Button labels get a little extra on top (about 1.85x the base scale). */
export const BUTTON_TEXT_BOOST = 1.15
export type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
export const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * TEXT_BOOST * (distanceCm / 110)
}
export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

export const CONTENT_Z = 0.6
export const LAYOUT_Z_LIFT = 0.02
export const BUTTON_LABEL_Z = 0.08

export function makeObj(parent: SceneObject, name: string, pos?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (pos) so.getTransform().setLocalPosition(pos)
  return so
}

/** Raw Text with an explicit layout rect (safe in rows and columns). */
export function makeText(parent: SceneObject, name: string, text: string, role: TextRole, distanceCm: number,
    widthCm: number, heightCm: number, color: vec4, align: HorizontalAlignment = HorizontalAlignment.Center): Text {
  const so = makeObj(parent, name)
  const t = so.createComponent("Component.Text") as Text
  t.text = text
  t.depthTest = true
  applyTextRole(t, role, distanceCm)
  t.horizontalAlignment = align
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  t.textFill.color = color
  return t
}

/** Registers `child` as a fixed-size item of the FlexLayout on `parent`. */
export function addToFlex(parent: SceneObject, child: SceneObject, w: number, h: number, stretch: boolean = false): FlexItem {
  const item = child.createComponent(FlexItem.getTypeName()) as FlexItem
  if (w > 0) item.overrideWidth = w
  if (h > 0) item.overrideHeight = h
  item.flexGrow = 0
  item.flexShrink = 0
  if (stretch) item.alignSelf = FlexAlignSelf.Stretch
  const layout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout | null
  if (layout) layout.addItems([item])
  return item
}

export interface FlexOpts {gap?: number; padX?: number; padY?: number; justify?: FlexJustify; align?: FlexAlign}

/** Adds a configured FlexLayout to an existing SceneObject. */
export function makeFlex(so: SceneObject, direction: FlexDirection, w: number, h: number, opts?: FlexOpts): FlexLayout {
  const f = so.createComponent(FlexLayout.getTypeName()) as FlexLayout
  // children are registered explicitly with addItems (see addToFlex), in build order
  f.autoDiscoverItemsOnStart = false
  f.onInitialized.add(() => {
    f.width = w
    f.height = h
    f.direction = direction
    if (direction === FlexDirection.Row) f.columnGap = opts?.gap ?? 0
    else f.rowGap = opts?.gap ?? 0
    f.paddingTop = opts?.padY ?? 0
    f.paddingBottom = opts?.padY ?? 0
    f.paddingLeft = opts?.padX ?? 0
    f.paddingRight = opts?.padX ?? 0
    f.justifyContent = opts?.justify ?? FlexJustify.Center
    f.alignItems = opts?.align ?? FlexAlign.Center
  })
  return f
}

export interface ButtonOpts {
  label?: string
  icon?: Texture
  iconLayout?: "left" | "right" | "top" | "bottom"
  distanceCm: number
  iconSize?: number
  style?: string
  toggleable?: boolean
}

/**
 * UIKit Button whose whole face is one ElementContent (icon + label), the
 * single-child case where ElementContent sizes itself correctly.
 * The SceneObject name is what LEAF finds the Interactable by.
 */
export function makeButton(parent: SceneObject, name: string, w: number, h: number, opts: ButtonOpts): {btn: Button; content: ElementContent} {
  const so = makeObj(parent, name)
  const btn = so.createComponent(Button.getTypeName()) as Button
  btn.size = new vec3(w, h, 1)
  if (opts.style) btn.setVariant({theme: "SnapOS2", style: opts.style})
  if (opts.toggleable) btn.setIsToggleable(true)
  const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
  if (opts.label !== undefined) ec.text = opts.label
  ec.textSize = roleSize("Button", opts.distanceCm) * BUTTON_TEXT_BOOST
  if (opts.icon) {
    ec.leadingIcon = opts.icon
    ec.leadingIconSize = opts.iconSize ?? Math.min(w, h) * 0.38
  }
  if (opts.iconLayout) ec.iconLayout = opts.iconLayout
  ec.contentAlignment = "center"
  ec.spacing = 0.35
  return {btn, content: ec}
}

// Additive display: lower alpha / darker = dimmer. Keep every label near-white or a light tint.
export const TEXT_PRIMARY = new vec4(1, 1, 1, 1)
export const TEXT_SECONDARY = new vec4(0.94, 0.97, 1, 1)
export const TEXT_CAPTION = new vec4(0.86, 0.92, 0.96, 1)
export const TEXT_ACCENT = new vec4(0.62, 1.0, 0.95, 1)
