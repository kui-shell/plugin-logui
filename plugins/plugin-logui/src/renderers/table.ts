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

import { safeDump } from 'js-yaml'

import { i18n } from '@kui-shell/core/api/i18n'
import { Tab, MultiModalResponse } from '@kui-shell/core/api/ui-lite'
import { Table, Cell } from '@kui-shell/core/api/table-models'
import Commands from '@kui-shell/core/api/commands'

import {
  KubeOptions,
  getNamespace,
  KubeResource,
  KubeResourceWithSummary,
  InvolvedObject
} from '@kui-shell/plugin-kubeui'

import { LogEntry } from '../models/entry'

import apiVersion from '../controller/kubectl/apiVersion'

// here are the known log parsers
import json from '../formats/json'
import nginx from '../formats/nginx'
import zapr from '../formats/zapr'
import plain from '../formats/plain'

const strings = i18n('plugin-logui')

/** log parsers that can be defined by a RegExp */
interface PatternLogParser {
  pattern: RegExp
  nColumns: number
  entry(match: string[]): LogEntry
}

/** log parsers that cannot easily be defined by a RegExp */
interface LineByLineLogParser {
  entry(line: string): LogEntry
}

type LogParser = PatternLogParser | LineByLineLogParser

/** distinguishes between PatternLogParser and LineByLineLogParser */
function isPatternLogParser(parser: LogParser): parser is PatternLogParser {
  return (parser as PatternLogParser).pattern !== undefined
}

const formats = [nginx, zapr, json, plain]

/**
 * Attempt to parse the given `raw` log string using the given
 * `LogParser`
 *
 */
const tryParse = (raw: string) => (fmt: LogParser): LogEntry[] => {
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

/**
 * Turn entry.level into HTML
 *
 */
function formatLevel(entry: LogEntry): string {
  if (entry.level === 'ERROR') {
    return 'red-background'
  } else if (entry.level === 'WARN') {
    return 'yellow-background'
  } else if (entry.level === 'INFO') {
  } else {
  }
}

/**
 * onclick
 *
 */
function showLogEntry(
  logLine: LogEntry,
  { involvedObject }: InvolvedObject
): MultiModalResponse<KubeResourceWithSummary & InvolvedObject> {
  const modes = logLine.messageDetail
    ? [
        {
          mode: 'details',
          label: strings('Details'),
          content: JSON.stringify(logLine.messageDetail, undefined, 2),
          contentType: 'json'
        }
      ]
    : []

  return {
    apiVersion,
    kind: 'log entry',
    isSimulacrum: true,
    originatingCommand: undefined,
    metadata: {
      name: involvedObject.name,
      namespace: involvedObject.namespace
    },
    toolbarText: {
      type:
        logLine.level === 'DEBUG' || logLine.level === 'INFO' ? 'info' : logLine.level === 'WARN' ? 'warning' : 'error',
      text: strings('Occurred at', logLine.timestamp)
    },
    data: safeDump(logLine),
    summary: {
      content: logLine.message
    },
    modes,
    involvedObject
  }
}

/**
 *
 *
 */
export function formatAsTable(raw: string, args?: Commands.Arguments<KubeOptions>): Table {
  const name = args.argvNoOptions[args.argvNoOptions.indexOf('logs') + 1]
  const namespace = (args && getNamespace(args)) || 'default'
  const kindMatch = name.match(/(\w+)\//)
  const kindOfInvolved = kindMatch ? kindMatch[1] : 'pod'
  const apiVersionOfInvolved = /^deploy/i.test(kindOfInvolved)
    ? 'extensions/v1beta1'
    : /^job/i.test(kindOfInvolved)
    ? 'batch/v1'
    : 'v1'

  const involvedObject = {
    apiVersion: apiVersionOfInvolved,
    kind: kindOfInvolved,
    name,
    namespace
  }

  const logLines = formats.map(tryParse(raw)).filter(_ => _.length > 0)[0]

  // headers
  const level = [{ value: strings('Level') }]

  const aDetail1 = logLines.find(_ => _.detail1)
  const detail1 = aDetail1 ? [{ value: aDetail1.detail1Key || strings('Details') }] : []

  const aDetail2 = logLines.find(_ => _.detail2)
  const detail2 = aDetail2 ? [{ value: aDetail2.detail2Key || strings('More Details') }] : []

  const message = [{ value: strings('Message'), css: 'hide-with-sidecar' }]

  const header = {
    name: strings('Timestamp'),
    attributes: level
      .concat(detail1)
      .concat(detail2)
      .concat(message)
  }

  return {
    header,
    body: logLines.map(logLine => {
      const attributes: Cell[] = []

      attributes.push({
        tag: 'badge',
        value: logLine.level,
        css: formatLevel(logLine)
      })

      if (logLine.detail1) {
        attributes.push({ value: logLine.detail1 })
      }

      if (logLine.detail2) {
        attributes.push({ value: logLine.detail2 })
      }

      attributes.push({
        value: logLine.message,
        css: 'somewhat-smaller-text pre-wrap slightly-deemphasize hide-with-sidecar'
      })

      /* if (logLine.messageDetail) {
        const value =
          Object.keys(logLine.messageDetail).length === 0 ? '' : JSON.stringify(logLine.messageDetail, undefined, 2)
        attributes.push({ value: value, css: 'smaller-text pre-wrap break-all sub-text' })
      } */

      return {
        name: logLine.timestamp || logLine.message,
        outerCSS: 'not-a-name',
        onclick: showLogEntry(logLine, { involvedObject }),
        tag: 'div',
        attributes
      }
    })
  }
}

/**
 * Takes an already-fetched kube log resource and returns a table of
 * its raw log data
 *
 */
export default function renderLogs(tab: Tab, resource: KubeResource): Table {
  return formatAsTable(resource.data)
}
