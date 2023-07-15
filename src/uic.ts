import { getStationData } from './hafas.js'

const stationCache = new Map()
// stationCache.set('5100069', '5100143')

export async function getUICStationCode(hafasCode: string): Promise<string> {
	if (stationCache.has(hafasCode)) {
		return stationCache.get(hafasCode)
	}

	const sparqlQuery = `SELECT DISTINCT ?item ?statement ?propertyValue WHERE {
        ?statement ps:P954 "${hafasCode}".
        ?item p:P954 ?statement;
              wdt:P722 ?propertyValue.
      }`

	const url =
		'https://query.wikidata.org/sparql' +
		'?query=' +
		encodeURIComponent(sparqlQuery)
	const headers = { Accept: 'application/sparql-results+json' }

	const res = await fetch(url, { headers }).then((res) => res.json())

	let uicCode: string
	if (res.results.bindings.length > 0) {
		uicCode = res.results.bindings[0].propertyValue.value
	} else {
		const data = await getStationData(hafasCode)
		const res = await fetch(
			`https://www.intercity.pl/station/get/?q=${data.name}`,
		).then((res) => res.json())
		try {
			uicCode = res[0].e
		} catch (err) {
			console.log(data.name, res.h, res.e)
			throw err
		}
	}

	stationCache.set(hafasCode, uicCode)

	return uicCode
}

// https://www.intercity.pl/station/get/?q=katowice
