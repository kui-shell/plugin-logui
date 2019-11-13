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

import Commands from '@kui-shell/core/api/commands'
import { KubeOptions, doExecRaw, defaultFlags as flags, getNamespace } from '@kui-shell/plugin-kubeui'

import commandPrefix from '../command-prefix'
import { formatAsTable } from '../../renderers/table'

async function doLogs(args: Commands.Arguments<KubeOptions>) {
  const name = args.argvNoOptions[args.argvNoOptions.indexOf('logs') + 1]
  const namespace = (args && getNamespace(args)) || 'default'
  return formatAsTable(await doExecRaw(args.command.replace(new RegExp(`^\\s*${commandPrefix}`), '')), {
    name,
    namespace
  })
}

export default async (registrar: Commands.Registrar) => {
  await Promise.all([
    registrar.override(`/${commandPrefix}/kubectl/logs`, 'plugin-kubeui', doLogs, flags),
    registrar.override(`/${commandPrefix}/k/logs`, 'plugin-kubeui', doLogs, flags)
  ])
}
