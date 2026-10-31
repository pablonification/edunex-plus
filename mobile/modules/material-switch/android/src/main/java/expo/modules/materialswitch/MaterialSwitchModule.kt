// Android's own Material 3 switch (MaterialSwitch) as a view the app's screens use through
// src/ui/controls.tsx's Switch: the track, the thumb that grows and the check, the ripple, the
// animation, TalkBack's "switch, on" and the haptic tick are Material's, not drawn in JS (W9).
package expo.modules.materialswitch

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MaterialSwitchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MaterialSwitch")

    View(MaterialSwitchView::class) {
      Events("onValueChange")

      Prop("value") { view: MaterialSwitchView, value: Boolean -> view.setValue(value) }
      Prop("enabled") { view: MaterialSwitchView, enabled: Boolean -> view.setOn(enabled) }
      Prop("label") { view: MaterialSwitchView, label: String? -> view.setLabel(label) }
      // The theme's roles as "#rrggbb": trackOn, trackOff, thumbOn, thumbOff, outline, icon.
      Prop("colors") { view: MaterialSwitchView, colors: Map<String, String>? -> view.setColors(colors ?: emptyMap()) }
      // A number JS changes to put the switch back at `value` (a tap the screen didn't take).
      Prop("sync") { view: MaterialSwitchView, _: Int -> view.sync() }
    }
  }
}
