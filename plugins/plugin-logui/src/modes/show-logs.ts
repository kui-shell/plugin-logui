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

import { i18n } from '@kui-shell/core/api/i18n'
import { Tab } from '@kui-shell/core/api/ui-lite'
import { KubeResource, isJob, isDeployment, isPod } from '@kui-shell/plugin-kubeui'

import commandPrefix from '../controller/command-prefix'

const strings = i18n('plugin-logui')

/**
 * Drill down to deployment logs
 *
 */
function deploymentLogs(tab: Tab, resource: KubeResource) {
  return `${commandPrefix} kubectl logs deployment/${resource.metadata.name} -n ${resource.metadata.namespace} --all-containers --tail 20`
}

/**
 * Drill down to job logs
 *
 */
function jobLogs(tab: Tab, resource: KubeResource) {
  return `${commandPrefix} kubectl logs job/${resource.metadata.name} -n ${resource.metadata.namespace} --tail 20`
}

/**
 * Drill down to pod logs
 *
 */
function podLogs(tab: Tab, resource: KubeResource) {
  return `${commandPrefix} kubectl logs ${resource.metadata.name} -n ${resource.metadata.namespace} --tail 20`
}

/**
 * @return whether the given resource has a logs
 *
 */
function hasLogs(resource: KubeResource): boolean {
  return isPod(resource) || isDeployment(resource) || isJob(resource)
}

/**
 * Log renderer
 *
 */
const renderLogs = (tab: Tab, resource: KubeResource) => {
  if (isDeployment(resource)) {
    return deploymentLogs(tab, resource)
  } else if (isPod(resource)) {
    return podLogs(tab, resource)
  } else if (isJob(resource)) {
    return jobLogs(tab, resource)
  } else {
    return ''
  }
}

/**
 * This is our mode model for the Last Applied tab.
 *
 */
export default {
  when: hasLogs,
  mode: {
    mode: 'logs',
    label: strings('Show Logs'),
    command: renderLogs,
    kind: 'drilldown' as const
  }
}
