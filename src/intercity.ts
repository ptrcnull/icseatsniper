import { XMLParser } from 'fast-xml-parser'
import fs from 'fs/promises'
import { getEMUStationCode } from './hafas.js'
import { getUICStationCode } from './uic.js'

// service=sklad&kategoria=IC&numer=3554
// dataWyjazduPociagu=202307170545&dataPrzyjazduPociagu=202307171422
// stacjaOd=5100042&stacjaDo=5100177&typSkladu=WAGONOWY
export interface TrainParams {
	kategoria: string
	numer: string
	dataWyjazduPociagu: string
	dataPrzyjazduPociagu: string
	stacjaOd: string
	stacjaDo: string
	typSkladu?: string
}

export interface TrainCarParams extends TrainParams {
	wagon: string
	data: string
	nrSkladu: string
}

export function getTrainCarParams(
	data: TrainData,
	trainCar: number | string,
): TrainCarParams {
	const nrSkladu = data.wagonySchemat
		? data.wagonySchemat[trainCar.toString()]
		: ''
	return {
		...data._trainParams,
		wagon: trainCar.toString(),
		data: data._trainParams.dataWyjazduPociagu.substring(0, 8),
		nrSkladu: nrSkladu,
		typSkladu: data.typSkladu,
	}
}

const trainTypes = ['WAGONOWY', 'ED160']

export interface TrainData {
	pojazdTyp: string
	pojazdNazwa: string
	typSkladu: string
	wagony: number[]
	wagonyUdogodnienia: { [trainCar: string]: string[] }
	wagonyNiedostepne: number[]
	klasa0: number[]
	klasa1: number[]
	klasa2: number[]
	kierunekJazdy: number // TODO: 1 / 2?
	wagonySchemat?: { [trainCar: string]: string }
	klasaDomyslnyWagon: { [trainCar: string]: number }
	zmieniaKierunek: boolean

	_trainParams: TrainParams
}

export async function getTrainData(params: TrainParams): Promise<TrainData> {
	let res: TrainData | undefined

	if (params.typSkladu) {
		const res = await _getTrainData(params)
		res.typSkladu = params.typSkladu
		return res
	}

	for (let trainType of trainTypes) {
		const newParams = {
			...params,
			typSkladu: trainType,
		}
		try {
			res = await _getTrainData(newParams)
			res.typSkladu = trainType
		} catch (err) {
			if ((err as any).toString().includes('is not valid JSON')) {
				continue
			}
			console.error(err)
		}
	}

	if (res == null) {
		throw new Error('did not get any train cars for: ' + params)
	}

	return res
}

async function _getTrainData(params: TrainParams): Promise<TrainData> {
	const newParams = {
		service: 'sklad',
		...params,
		stacjaOd: await getUICStationCode(params.stacjaOd),
		stacjaDo: await getUICStationCode(params.stacjaDo),
	}
	const url =
		'https://bilet.intercity.pl/EicServerProxy?' +
		new URLSearchParams(newParams)

	// console.log('fetching', url)
	const res = await fetch(url).then((res) => res.json())

	if (res == null) {
		throw new Error('did not get any train cars for: ' + params)
	}

	res._trainParams = params
	return res
}

export interface Seat {
	taken: boolean
	seat: number
	special: boolean
}

type TrainCarData = ReadonlyArray<Seat>

export async function getTrainCarData(
	params: TrainCarParams,
	tripId: string,
): Promise<TrainCarData> {
	if (params.typSkladu == null) {
		throw new Error('params.typSkladu cannot be null here!')
	}

	const newParams = {
		service: 'wagon/svg',
		...params,
	}
	if (params.typSkladu !== 'WAGONOWY') {
		newParams.stacjaOd = await getEMUStationCode(tripId, params.stacjaOd)
		newParams.stacjaDo = await getEMUStationCode(tripId, params.stacjaDo)
	} else {
		newParams.stacjaOd = await getUICStationCode(params.stacjaOd)
		newParams.stacjaDo = await getUICStationCode(params.stacjaDo)
	}

	const url =
		'https://bilet.intercity.pl/EicServerProxy?' +
		new URLSearchParams(newParams)

	// console.log('fetching', url)
	const res = await fetch(url).then((res) => res.text())
	const parser = new XMLParser({
		ignoreAttributes: false,
	})
	const svgData = parser.parse(res)

	const getImage = (g: any) => (Array.isArray(g.image) ? g.image[0] : g.image)

	if (svgData.svg == null) {
		console.log('failed to fetch train cars', url)
	}

	// await fs.writeFile('output.svg', res, 'utf-8')

	return svgData.svg.g.map((g: any) => ({
		taken: getImage(g)['@_xlink:href'].includes('grm/3'),
		seat: g.text['#text'],
		special: Array.isArray(g.image),
		// img: g.image,
	}))
}
