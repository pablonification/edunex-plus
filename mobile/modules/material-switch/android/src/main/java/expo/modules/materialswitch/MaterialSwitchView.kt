// One MaterialSwitch in the box React Native lays out (52 × 48 dp: the track's size, a 48 dp
// target). It's controlled: `value` comes from JS, a tap tells JS the new value and moves at
// once (the thumb's animation is Material's); JS answers with the value it keeps.
package expo.modules.materialswitch

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.view.ContextThemeWrapper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import com.google.android.material.materialswitch.MaterialSwitch
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class MaterialSwitchView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // The switch is a child React Native doesn't lay out: Android measures and places it in this view's box.
  override val shouldUseAndroidLayout = true

  private val onValueChange by EventDispatcher()
  private var value = false
  private var applying = false

  // The app's activity theme isn't a Material 3 one: the switch gets Material 3's own, so its style resolves.
  private val themed = ContextThemeWrapper(context, com.google.android.material.R.style.Theme_Material3_DayNight)
  private val check = ContextCompat.getDrawable(context, R.drawable.material_switch_check)

  private val toggle =
    MaterialSwitch(themed).apply {
      // No text, no room of its own around the track: the box React Native gives is the toggle.
      text = null
      showText = false
      minWidth = 0
      minHeight = 0
      minimumWidth = 0
      minimumHeight = 0
      setPadding(0, 0, 0, 0)
      gravity = Gravity.CENTER
      layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
      setOnCheckedChangeListener { _, checked ->
        showIcon(checked)
        if (!applying) onValueChange(mapOf("value" to checked))
      }
    }

  init {
    gravity = Gravity.CENTER
    // TalkBack reads the switch itself ("<label>, switch, on"), not this box around it.
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    addView(toggle)
    showIcon(false)
  }

  fun setValue(next: Boolean) {
    value = next
    sync()
  }

  /** Puts the switch at JS's value without telling JS about it. */
  fun sync() {
    if (toggle.isChecked == value) return
    applying = true
    toggle.isChecked = value
    applying = false
  }

  fun setOn(enabled: Boolean) {
    toggle.isEnabled = enabled
  }

  fun setLabel(label: String?) {
    toggle.contentDescription = label
  }

  fun setColors(colors: Map<String, String>) {
    fun color(name: String, fallback: Int) = colors[name]?.let { runCatching { Color.parseColor(it) }.getOrNull() } ?: fallback
    val on = intArrayOf(android.R.attr.state_checked)
    val off = intArrayOf()
    fun states(checked: Int, unchecked: Int) = ColorStateList(arrayOf(on, off), intArrayOf(checked, unchecked))
    val trackOn = color("trackOn", toggle.trackTintList?.defaultColor ?: Color.BLUE)
    val outline = color("outline", Color.GRAY)
    toggle.trackTintList = states(trackOn, color("trackOff", Color.LTGRAY))
    // The outline only while off, as Material 3's switch: on, the track is one fill.
    toggle.trackDecorationTintList = states(trackOn, outline)
    toggle.thumbTintList = states(color("thumbOn", Color.WHITE), color("thumbOff", outline))
    toggle.thumbIconTintList = states(color("icon", trackOn), Color.TRANSPARENT)
  }

  // The check on the thumb while it's on; off, a small thumb with nothing on it (Material 3's "icon when selected").
  private fun showIcon(checked: Boolean) {
    toggle.thumbIconDrawable = if (checked) check else null
  }
}
