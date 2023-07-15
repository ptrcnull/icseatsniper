import { ListChoiceOptions } from 'inquirer'
import {
	Leg,
	Station,
	Stop,
	Location,
	StopOver,
	TripWithRealtimeData,
	createClient,
} from 'hafas-client'
import { profile as pkpProfile } from 'hafas-client/p/pkp/index.js'
import { profile as dbProfile } from 'hafas-client/p/db/index.js'
import { profile as rejseplanenProfile } from 'hafas-client/p/rejseplanen/index.js'
import { Answers } from './prompt.js'
import { getTime } from './utils.js'

const client = createClient(pkpProfile, 'IC Seat Sniper')
const tripCache = new Map()

export async function getStations(
	input: string | undefined,
): Promise<ListChoiceOptions[]> {
	if (!input) {
		return []
	}
	try {
		const stations = await client.locations(input, { language: 'pl' })
		return stations.map((station) => ({
			name: station.name,
			value: station.id,
		}))
	} catch (err) {
		console.error(err)
		return []
	}
}

// journeys.journeys![0].legs.filter(leg => leg.line?.operator?.id === 'pkp-intercity')

export async function getJourneys(data: Answers): Promise<ListChoiceOptions[]> {
	const offset = new Date()
		.toLocaleTimeString('sv', {
			timeZoneName: 'longOffset',
		})
		.split(' ')[1]
		.replace('GMT', '')
	const departure = new Date(data.date + 'T' + data.time + ':00' + offset)

	const journeys = await client.journeys(data.from!, data.to!, {
		departure,
		transfers: 0,
	})
	return (
		journeys.journeys?.map((journey) => {
			const startLeg = journey.legs.at(0)!
			const endLeg = journey.legs.at(-1)!
			const reformatTime = (dateString: string) => getTime(new Date(dateString))

			const start = `${reformatTime(startLeg.departure!)} ${
				startLeg.origin?.name
			}`
			const end = `${reformatTime(endLeg.arrival!)} ${endLeg.destination?.name}`
			const trains = journey.legs.map((leg) => leg.line?.name).join('|')
			return {
				name: `${start} [${trains}] ${end}`,
				value: journey.legs[0], // TODO: uhhhh more legs 🥵
			}
		}) ?? []
	)
}

async function getTrip(tripId: string): Promise<TripWithRealtimeData> {
	if (tripCache.has(tripId)) {
		return tripCache.get(tripId)
	}
	const res = await client.trip!(tripId, {})
	tripCache.set(tripId, res)
	return res
}

export async function getTripStations(
	leg: Leg,
): Promise<ReadonlyArray<StopOver>> {
	const trip = await getTrip(leg.tripId!)
	const stops = trip.trip.stopovers!

	const startIndex = stops.findIndex((stop) => stop.stop?.id === leg.origin?.id)
	const endIndex = stops.findIndex(
		(stop) => stop.stop?.id === leg.destination?.id,
	)

	return stops.slice(startIndex, endIndex + 1)
}

export async function getEMUStationCode(
	tripId: string,
	hafasCode: string,
): Promise<string> {
	const trip = await getTrip(tripId)
	const stopIndex = trip.trip.stopovers!.findIndex(
		(stop) => stop.stop?.id === hafasCode,
	)
	return ((stopIndex + 1) * 5).toString()
}

export async function getStationData(hafasCode: string) {
	return client.stop(hafasCode, {})
}
