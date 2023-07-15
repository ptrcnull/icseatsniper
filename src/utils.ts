export function trimSeconds(time: string): string {
	return time.split(':').slice(0, 2).join(':')
}

export function getTime(date: Date): string {
	return trimSeconds(date.toLocaleTimeString('sv'))
}

export function getDate(date: Date): string {
	return date.toLocaleDateString('sv')
}
