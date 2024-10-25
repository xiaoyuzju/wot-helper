import { Context, Schema, Universal } from 'koishi'
import { h } from 'koishi'
import Undios from '@cordisjs/plugin-http'
import { toNamespacedPath } from 'path'

export const name = 'wot-helper'

export interface Config { }

export interface Config {
  wargaming_application_id: string
}

export const Config: Schema<Config> = Schema.object({
  wargaming_application_id: Schema.string().required(),
})

function toSafeString(value: any): string {
  if (value === null) {
    return 'null';
  }
  return value.toString();
}

const http = new Undios()

export function apply(ctx: Context, config: Config) {
  enum RegionDomain {
    asia = 'asia',
    eu = 'eu',
    na = 'com',
  }

  ctx.command('recents <region> <player_id>')
    .action(async ({ session }, region, player_id) => {
      const region_domain = RegionDomain[region]
      if (!region_domain) {
        await session.send(`不支持的地区 ${region}`)
        return
      }
      // TODO 这里改成回复
      await session.send(h('at', { id: session.userId }) + ` 正在查询 ${region} 区 ${player_id} 的最近战绩...`)
      
      const wargaming_account_url = `https://api.worldoftanks.${RegionDomain[region]}/wot/account/list/?application_id=${config.wargaming_application_id}&search=${player_id}`
      const wargaming_account_data = JSON.parse(JSON.stringify(await http.get(wargaming_account_url)))
      const wargaming_account_id = wargaming_account_data['data'][0]['account_id']
      // TODO 增加错误处理
      // TODO 增加其他功能
      // await session.send(`account_id: ${wargaming_account_id}`)

      const tomato_url = `https://api.tomato.gg/dev/api-v2/player/recents/${region_domain}/${wargaming_account_id}?cache=false&days=1,3,7,30,60&battles=1000,100`
      const tomato_recents_data = JSON.parse(JSON.stringify(await http.get(tomato_url)))

      let tomato_recents_str = h('at', { id: session.userId }) + `\n${region} ${player_id}\n`
      for (const day of ['1', '3', '7', '30', '60']) {
        const day_recents = tomato_recents_data['data']['days'][day]['overall']
        tomato_recents_str += `day ${toSafeString(day).padStart(2, ' ')} `
        tomato_recents_str += `wn8 ${toSafeString(day_recents['wn8']).padStart(4,' ')} `
        tomato_recents_str += `battles ${toSafeString(day_recents['battles']).padStart(4,' ')} `
        tomato_recents_str += `winrate ${toSafeString(day_recents['winrate']).padStart(4,' ')} `
        tomato_recents_str += `\n`
      }
      await session.send(tomato_recents_str)
      // await session.send('查询完毕')
    });
}


// ws://192.168.31.10:5140/onebot