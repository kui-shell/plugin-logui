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

import { Tab } from '@kui-shell/core/api/ui-lite'
import { Table } from '@kui-shell/core/api/table-models'
import { doExecRaw, KubeResource, isJob, isDeployment, isPod } from '@kui-shell/plugin-kubeui'

import { LogEntry } from './entry'

import nginx from '../formats/nginx'
import zapr from '../formats/zapr'
import plain from '../formats/plain'

interface LogParser {
  pattern: RegExp
  nColumns: number
  entry(match: string[]): LogEntry
}

const formats = [nginx, zapr, plain]

const tryParse = (raw: string) => (fmt: LogParser) => {
  const logLines = raw.split(fmt.pattern)
  const nLines = logLines.length / fmt.nColumns

  if (nLines > 0) {
    const entries: LogEntry[] = []
    for (let idx = 0; idx < nLines; idx++) {
      const slice = logLines.slice(idx * fmt.nColumns, (idx + 1) * fmt.nColumns)
      if (slice.length === fmt.nColumns) {
        entries.push(fmt.entry(slice))
      }
    }
    return entries
  }
}

function formatNamePart(entry: LogEntry) {
  const dom = document.createElement('div')
  dom.classList.add('smaller-text', 'min-width-date-like')

  const ts = document.createElement('div')
  dom.appendChild(ts)
  ts.innerText = entry.timestamp

  const details = document.createElement('div')
  const d1 = document.createElement('div')
  const d2 = document.createElement('div')

  dom.appendChild(details)
  details.appendChild(d1)
  details.appendChild(d2)
  d1.innerText = entry.detail1
  d2.innerText = entry.detail2
  details.classList.add('flex-layout', 'sub-text', 'lighter-text', 'smaller-text')
  d2.classList.add('small-left-pad')

  if (entry.level === 'ERROR') {
    d1.classList.add('red-text')
  }

  return dom
}

function formatAsTable(raw: string): Table {
  const logLines = formats.map(tryParse(raw)).filter(_ => _.length > 0)[0]

  return {
    body: logLines.map(logLine => ({
      name: logLine.timestamp || logLine.message,
      nameDom: logLine.timestamp ? formatNamePart(logLine) : undefined,
      attributes: !logLine.timestamp ? undefined : [{ value: logLine.message }]
    }))
  }
}

/**
 * Render Deployment logs
 *
 */
async function renderDeploymentLogs(tab: Tab, resource: KubeResource): Promise<Table> {
  const command = `kubectl logs deployment/${resource.metadata.name} -n ${resource.metadata.namespace} --all-containers --tail 1000`
  return formatAsTable(await doExecRaw(command))
}

/**
 * Render Job logs
 *
 */
async function renderJobLogs(tab: Tab, resource: KubeResource): Promise<Table> {
  const command = `kubectl logs job/${resource.metadata.name} -n ${resource.metadata.namespace} --tail 1000`
  return formatAsTable(await doExecRaw(command))
}

/**
 * Render Pod logs
 *
 */
async function renderPodLogs(tab: Tab, resource: KubeResource): Promise<Table> {
  const command = `kubectl logs ${resource.metadata.name} -n ${resource.metadata.namespace} --tail 1000`
  return formatAsTable(await doExecRaw(command))
}

/**
 * @return whether the given resource has a logs
 *
 */
function hasLogs(resource: KubeResource): boolean {
  return isPod(resource) || isDeployment(resource)
}

/**
 * Log renderer
 *
 */
const renderLogs = async (tab: Tab, resource: KubeResource) => {
  if (isDeployment(resource)) {
    return renderDeploymentLogs(tab, resource)
  } else if (isPod(resource)) {
    return renderPodLogs(tab, resource)
  } else if (isJob(resource)) {
    return renderJobLogs(tab, resource)
  }
  return {
    content: 'temp'
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
    content: renderLogs
  }
}
