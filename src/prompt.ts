import { Leg } from 'hafas-client'

import inquirer from 'inquirer'
import AutocompletePrompt from 'inquirer-autocomplete-prompt'
inquirer.registerPrompt('autocomplete', AutocompletePrompt)

import { getJourneys, getStations } from './hafas.js'

export interface Answers {
	from?: string
	to?: string
	date?: string
	time?: string
	journey?: Leg
}

const questions = [
	{
		type: 'autocomplete',
		name: 'from',
		message: 'From?',
		source: (answers: Answers, input: string) => getStations(input),
	},
	{
		type: 'autocomplete',
		name: 'to',
		message: 'To?',
		source: (answers: Answers, input: string) => getStations(input),
	},
	{
		type: 'input',
		name: 'date',
		message: 'What date?',
		default: () => new Date().toLocaleDateString('sv'),
		validate: (str: string) => str.match(/^\d{4}-\d{2}-\d{2}$/) != null,
	},
	{
		type: 'input',
		name: 'time',
		message: 'What time?',
		default: () =>
			new Date().toLocaleTimeString('sv').split(':').slice(0, 2).join(':'),
		validate: (str: string) => str.match(/^\d{2}:\d{2}$/) != null,
	},
	{
		type: 'list',
		name: 'journey',
		message: 'Which journey?',
		choices: getJourneys,
	},
]

export function getAnswers(): Promise<Answers> {
	return inquirer.prompt(questions)
}
