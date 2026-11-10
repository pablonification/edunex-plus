Pod::Spec.new do |s|
  s.name           = 'WebCookies'
  s.version        = '1.0.0'
  s.summary        = "The web views' cookie store, for the app's sign-in"
  s.author         = ''
  s.homepage       = 'https://github.com/pablonification/edunex-plus'
  s.license        = { type: 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
