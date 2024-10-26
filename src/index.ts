import { Context, Schema, Universal } from 'koishi'
import { h } from 'koishi'
import Undios from '@cordisjs/plugin-http'

export const name = 'wot-helper'

export const inject = {
  required: ['database'],
}

export interface Config { }

export interface Config {
  wargaming_application_id: string
}

export const Config: Schema<Config> = Schema.object({
  wargaming_application_id: Schema.string().required(),
})

declare module 'koishi' {
  interface Tables {
    wot_user: WotUser
  }
}

export interface WotUser {
  id: number
  user_id: string
  wot_nickname: string
  region: string
}

const http = new Undios()

export function apply(ctx: Context, config: Config) {
  enum RegionDomain {
    asia = 'asia',
    eu = 'eu',
    na = 'com',
  }

  // const database_stats = ctx.database.stats().then(stats => stats.tables)

  // if (!database_stats.tables.wot_user || !ctx.model.tables.wot_user) {
  ctx.model.extend(
    'wot_user',
    {
      id: 'unsigned',
      user_id: 'string',
      wot_nickname: 'string',
      region: 'string',
    },
    {
      autoInc: true,
    }
  )
  // }

  ctx.command('recents [region] [wot_nickname]', '查询近期战绩')
    .action(async ({ session }, region, wot_nickname) => {
      if (!region && !wot_nickname) {
        const current_user = await ctx.database.get('wot_user', { user_id: [session.userId] })
        if (current_user.length == 0) {
          await session.send('请先绑定战绩查询账号')
          return
        }
        region = current_user[0].region
        wot_nickname = current_user[0].wot_nickname
      }

      const region_domain = RegionDomain[region]
      if (!region_domain) {
        await session.send(`不支持的地区 ${region}`)
        return
      }

      await session.send(h('at', { id: session.userId }) + ` 正在查询 ${region} 区 ${wot_nickname} 的最近战绩...`)

      const wot_account_url = `https://api.worldoftanks.${RegionDomain[region]}/wot/account/list/?application_id=${config.wargaming_application_id}&search=${wot_nickname}`
      const wot_account_data = JSON.parse(JSON.stringify(await http.get(wot_account_url)))
      // {"status":"ok","meta":{"count":1},"data":[{"nickname":"RTCrush","account_id":2025063035}]}
      if (wot_account_data['meta']['count'] === 0) {
        await session.send(h('at', { id: session.userId }) + ` 未找到 ${wot_nickname} 的战绩`)
        return
      }
      const wot_account_id = wot_account_data['data'][0]['account_id']
      console.log(`wot_account_id: ${wot_account_id}`)
      const tomato_url = `https://api.tomato.gg/dev/api-v2/player/recents/${region_domain}/${wot_account_id}?cache=false&days=1,3,7,30,60&battles=1000,100`
      const tomato_recents_data = JSON.parse(JSON.stringify(await http.get(tomato_url)))

      let tomato_recents_str = h('at', { id: session.userId }) + ` ${region} ${wot_nickname}\n`
      for (const day of ['1', '3', '7', '30', '60']) {
        const day_recents = tomato_recents_data['data']['days'][day]['overall']
        tomato_recents_str += `${day} 天: `
        tomato_recents_str += `WN8 ${day_recents['wn8']} `
        tomato_recents_str += `场次 ${day_recents['battles']} `
        tomato_recents_str += `胜率 ${day_recents['winrate']} `
        tomato_recents_str += `\n`
      }
      await session.send(tomato_recents_str)
      console.log(`done ${wot_account_id}`)
    });

  ctx.command('bind <region> <wot_nickname>', '绑定战绩查询')
    .action(async ({ session }, region, wot_nickname) => {
      const current_user = await ctx.database.get('wot_user', { user_id: [session.userId] })
      if (current_user.length == 0) {
        console.log(`create user ${session.userId} ${wot_nickname} ${region}`)
        await ctx.database.create('wot_user', {
          user_id: session.userId,
          wot_nickname: wot_nickname,
          region: region,
        })
      } else {
        console.log(`update user ${session.userId} ${wot_nickname} ${region}`)
        await ctx.database.set('wot_user', current_user[0].user_id, { wot_nickname: wot_nickname, region: region })
      }
      await session.send(h('at', { id: session.userId }) + ` 已绑定 ${region} ${wot_nickname}`)
    });
}
