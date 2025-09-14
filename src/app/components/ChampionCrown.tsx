'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import CrownIcon from './CrownIcon'

type ChampionCrownProps = {
	userId: string
}

export default function ChampionCrown({ userId }: ChampionCrownProps) {
	const user = useQuery(api.users.getUser, { userId })
	const isChampion = user?.isChampion === true

	if (!isChampion) return null

	return <CrownIcon size={16} />
}