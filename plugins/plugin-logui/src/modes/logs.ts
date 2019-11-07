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
import { Table, Cell } from '@kui-shell/core/api/table-models'
import Tables from '@kui-shell/core/api/tables'
import { doExecRaw, KubeResource, isJob, isDeployment, isPod } from '@kui-shell/plugin-kubeui'

import { LogEntry } from './entry'

import json from '../formats/json'
import nginx from '../formats/nginx'
import zapr from '../formats/zapr'
import plain from '../formats/plain'

interface PatternLogParser {
  pattern: RegExp
  nColumns: number
  entry(match: string[]): LogEntry
}

interface LineByLineLogParser {
  entry(line: string): LogEntry
}

type LogParser = PatternLogParser | LineByLineLogParser

function isPatternLogParser(parser: LogParser): parser is PatternLogParser {
  return (parser as PatternLogParser).pattern !== undefined
}

const formats = [nginx, zapr, json, plain]

const tryParse = (raw: string) => (fmt: LogParser) => {
  if (isPatternLogParser(fmt)) {
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
      return entries.filter(_ => _)
    }
  } else {
    return raw
      .split(plain.pattern)
      .map(fmt.entry)
      .filter(_ => _)
  }
}

function formatNamePart(entry: LogEntry) {
  const dom = document.createElement('div')
  dom.classList.add('smaller-text', 'small-top-pad', 'small-bottom-pad')
  dom.style.flexDirection = 'column'

  const ts = document.createElement('div')
  dom.appendChild(ts)
  ts.innerText = entry.timestamp

  const details = document.createElement('div')
  const d1 = document.createElement('div')
  const d2 = document.createElement('div')

  dom.appendChild(details)
  details.appendChild(d1)
  details.appendChild(d2)
  d1.innerText = entry.detail1 || ''
  d2.innerText = entry.detail2 || ''
  details.classList.add('flex-layout', 'sub-text', 'somewhat-smaller-text')
  d1.classList.add('semi-bold', 'capitalize')
  d2.classList.add('small-left-pad')

  return dom
}

function formatLevel(entry: LogEntry) {
  const d1 = document.createElement('span')

  if (entry.level === 'ERROR') {
    d1.classList.add('red-text')
    const svg = document.createElement('span')
    svg.innerHTML = ` <svg class="kui--error-icon" focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm2.7 10.5L4.5 5.3l.8-.8 6.2 6.2-.8.8z"></path>
                              <path d="M10.7 11.5L4.5 5.3l.8-.8 6.2 6.2-.8.8z" data-icon-path="inner-path"></path>
                            </svg>`
    d1.appendChild(svg)
  } else if (entry.level === 'WARN') {
    d1.classList.add('yellow-text')
    const svg = document.createElement('span')
    svg.innerHTML = `<svg class="kui--warning-icon" focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M8 1C4.2 1 1 4.2 1 8s3.2 7 7 7 7-3.1 7-7-3.1-7-7-7zm-.5 3h1v5h-1V4zm.5 8.2c-.4 0-.8-.4-.8-.8s.3-.8.8-.8c.4 0 .8.4.8.8s-.4.8-.8.8z"></path>
                              <path d="M7.5 4h1v5h-1V4zm.5 8.2c-.4 0-.8-.4-.8-.8s.3-.8.8-.8c.4 0 .8.4.8.8s-.4.8-.8.8z" data-icon-path="inner-path"></path>
</svg>`
    d1.appendChild(svg)
  } else if (entry.level === 'INFO') {
    /* d1.classList.add('normal-text')
    const svg = document.createElement('span')
    svg.innerHTML = ` <svg class="kui--info-icon" focusable="false" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M8.5 11V6.5h-2v1h1V11H6v1h4v-1zM8 3.5c-.4 0-.8.3-.8.8s.4.7.8.7.8-.3.8-.8-.4-.7-.8-.7z"></path>
                              <path d="M8 15c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7zM8 2C4.7 2 2 4.7 2 8s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z"></path>
                            </svg>`
    d1.appendChild(svg) */
  } else {
    d1.innerText = entry.level
  }

  return d1
}

function formatAsTable(raw: string): Table {
  const logLines = formats.map(tryParse(raw)).filter(_ => _.length > 0)[0]

  return {
    style: Tables.TableStyle.Heavy,
    body: logLines.map(logLine => {
      const attributes: Cell[] = []

      if (logLine.timestamp) {
        attributes.push({ value: logLine.message })
      }

      if (logLine.messageDetail) {
        const value =
          Object.keys(logLine.messageDetail).length === 0 ? '' : JSON.stringify(logLine.messageDetail, undefined, 2)
        attributes.push({ value: value, css: 'smaller-text pre-wrap break-all sub-text' })
      }

      attributes.push({ value: logLine.level, valueDom: formatLevel(logLine) })

      return {
        name: logLine.timestamp || logLine.message,
        nameDom: logLine.timestamp ? formatNamePart(logLine) : undefined,
        tag: 'div',
        attributes
      }
    })
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
