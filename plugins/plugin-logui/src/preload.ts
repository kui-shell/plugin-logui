/*
 * Copyright 2019 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { isHeadless } from '@kui-shell/core/api/capabilities'

import logs from './modes/logs'
import previous from './modes/previous'
import stackTrace from './modes/stack-trace'
import errorVerbose from './modes/error-verbose'
import drilldownToLogs from './modes/show-logs'

import levelBadge from './modes/level-badge'
import scopeBadge from './modes/scope-badge'

export default async () => {
  if (!isHeadless()) {
    const { registerBadge, registerMode } = await import('@kui-shell/core/api/registrars')
    registerMode(logs)
    registerMode(previous)
    registerMode(stackTrace)
    registerMode(errorVerbose)
    registerMode(drilldownToLogs)

    registerBadge(levelBadge)
    registerBadge(scopeBadge)
  }
}
