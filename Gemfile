source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
# Allow any 3.2.x patch level: the hosted macOS runners install the newest
# 3.2 patch available, and an exact pin ("3.2.3") makes bundler abort as
# soon as the image's newest patch moves past it.
ruby ">= 3.2.3", "< 3.3.0"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'xcodeproj', '< 1.26.0'
gem 'concurrent-ruby', '< 1.3.4'

# Ruby 3.4.0 has removed some libraries from the standard library.
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'


# Fastlane
gem "fastlane"
gem "fastlane-plugin-versioning"
gem 'fastlane-plugin-versioning_android'
