import { Leg, Stop, StopOver } from 'hafas-client'
import {
	getEMUStationCode,
	getJourneys,
	getStations,
	getTripStations,
} from './hafas.js'
import {
	Seat,
	TrainParams,
	getTrainCarData,
	getTrainCarParams,
	getTrainData,
} from './intercity.js'
import { Answers, getAnswers } from './prompt.js'
import { getDate, getTime } from './utils.js'

function buildTrainParams(
	leg: Leg,
	stationFrom: string,
	stationTo: string,
): TrainParams {
	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		const str = getDate(date) + getTime(date)
		return str.replace(/[^0-9]/g, '')
	}

	return {
		kategoria: leg.line!.productName!,
		numer: leg.line!.fahrtNr!,
		dataWyjazduPociagu: formatDate(leg.departure!),
		dataPrzyjazduPociagu: formatDate(leg.arrival!),
		stacjaOd: stationFrom,
		stacjaDo: stationTo,
	}
}

interface TrainSeat {
	seat: number
	car: number
}

class Segment extends Array<TrainSeat> {
	from?: string
	to?: string
}

async function main() {
	const answers = await getAnswers()

	// const trips = await getJourneys(answers)
	// answers.journey = trips[0].value!
	const tripId = answers.journey!.tripId!
	// console.log(answers.journey)

	const stations = await getTripStations(answers.journey!)
	// console.log(stations.map(st => st.stop?.name))

	const trainParams = buildTrainParams(
		answers.journey!,
		answers.from!,
		answers.to!,
	)

	const data = await getTrainData(trainParams)
	// console.log(
	// 	'woof',
	// 	data.pojazdNazwa,
	// 	data.pojazdTyp,
	// 	data.klasa1,
	// 	data.klasa2,
	// )

	// this one accepts hafas codes!
	const findSeatsInSegment = async (
		from: string,
		to: string,
	): Promise<Segment> => {
		const seats = []

		const trainParams = buildTrainParams(answers.journey!, from, to)
		trainParams.typSkladu = data.typSkladu
		const trainData = await getTrainData(trainParams)

		for (let trainCar of trainData.klasa2) {
			const trainCarParams = getTrainCarParams(trainData, trainCar)
			const carData = await getTrainCarData(trainCarParams, tripId)
			const carSeats = carData
				.filter((seat) => !seat.taken && !seat.special)
				.map((seat) => ({ seat: seat.seat, car: trainCar }))
			seats.push(...carSeats)
		}
		return Segment.from(seats)
	}

	const fullJourneySeats = await findSeatsInSegment(answers.from!, answers.to!)
	if (fullJourneySeats.length > 0) {
		console.log('seats:', fullJourneySeats)
		process.exit(0)
	}

	const segments = []

	console.log('looking for split seats...')
	for (let i = 0; i < stations.length - 1; i++) {
		const fromStop = stations[i].stop!
		const toStop = stations[i + 1].stop!

		const seats = await findSeatsInSegment(fromStop.id!, toStop.id!)
		seats.from = fromStop.name
		seats.to = toStop.name
		segments.push(seats)
		console.log(
			'(',
			fromStop.name,
			'-',
			toStop.name + ':',
			seats.length,
			'seats )',
		)
	}

	const targetSeats = []

	let currentSeats: Segment | undefined

	for (let i = 0; i < segments.length - 1; i++) {
		const currentSegment = currentSeats != null ? currentSeats : segments[i]
		const nextSegment = segments[i + 1]

		const sharedSeats: Segment = currentSegment.filter((seat: TrainSeat) =>
			nextSegment.find(
				(otherSeat: TrainSeat) =>
					seat.car === otherSeat.car && seat.seat === otherSeat.seat,
			),
		)
		if (sharedSeats.length > 0) {
			sharedSeats.from = currentSegment.from
			sharedSeats.to = nextSegment.to
			currentSeats = sharedSeats
		} else {
			targetSeats.push({
				from: currentSegment.from,
				to: currentSegment.to,
				seat: currentSegment.at(0)!,
			})
			currentSeats = nextSegment
		}
	}
	if (!currentSeats) throw new Error('no seats???')

	targetSeats.push({
		from: currentSeats.from,
		to: currentSeats.to,
		seat: currentSeats.at(0)!,
	})

	console.log('\nFound seats:')
	for (let s of targetSeats) {
		if (s.seat) {
			console.log(`${s.from} - ${s.to}: car`, s.seat.car, 'seat', s.seat.seat)
		} else {
			console.log(`${s.from} - ${s.to}: no seat :(`)
		}
	}
}
main().catch((err) => console.error('main error:', err))
