require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 })
  console.log('DB 연결 완료')

  const result = await mongoose.connection.collection('raids').deleteMany({
    raidAlias: "아브렐슈드",
    difficulty: { $in: ["익스트림 노말", "익스트림 하드", "나이트메어"] }
  })
  console.log(`삭제된 레이드: ${result.deletedCount}개`)

  // 고정 레이드도 정리
  const result2 = await mongoose.connection.collection('fixedraids').deleteMany({
    raidAlias: "아브렐슈드",
    difficulty: { $in: ["익스트림 노말", "익스트림 하드", "나이트메어"] }
  })
  console.log(`삭제된 고정 레이드: ${result2.deletedCount}개`)

  await mongoose.disconnect()
  console.log('완료')
}

main().catch(console.error)
