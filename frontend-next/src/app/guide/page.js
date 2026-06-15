import Link from "next/link"

export const metadata = {
  title: "사용 가이드 | 로미니",
  description: "로미니 로스트아크 레이드 모집 봇 사용 가이드. 봇 초대부터 캐릭터 연동, 레이드 생성, 고정 파티 운영까지 단계별로 안내합니다.",
}

function Section({ title, children }) {
  return (
    <section className="mb-12">
      <h2 className="text-xl font-bold text-white mb-5 pb-2 border-b border-white/10">{title}</h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-purple-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400 mt-0.5 shrink-0">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function FaqItem({ q, a }) {
  return (
    <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02]">
      <p className="text-sm font-semibold text-white mb-2">Q. {q}</p>
      <p className="text-sm text-gray-400 leading-relaxed">A. {a}</p>
    </div>
  )
}

function CommandBadge({ cmd, desc }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <code className="shrink-0 text-xs bg-white/10 text-purple-300 px-2 py-1 rounded font-mono">{cmd}</code>
      <span className="text-sm text-gray-400 leading-relaxed">{desc}</span>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          ← 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">사용 가이드</h1>
        <p className="text-sm text-gray-500 mb-10">로미니 봇을 처음 사용하시나요? 이 가이드를 따라가면 5분 안에 시작할 수 있습니다.</p>

        <div className="text-sm leading-relaxed">

          {/* 로미니란 */}
          <Section title="로미니란?">
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>
                로미니는 로스트아크 레이드 모집과 파티 관리를 Discord 봇과 웹 대시보드로
                편리하게 할 수 있도록 돕는 서비스입니다. 레이드 일정 등록부터 참가자 관리,
                캐릭터 연동, 고정 파티 운영까지 한 곳에서 처리할 수 있습니다.
              </p>
              <p>
                기존에는 Discord 채팅으로 수동으로 모집 공고를 올리고, 참가 신청을 하나씩
                확인하며, 별도로 일정을 공지해야 했습니다. 로미니는 이 과정을 자동화합니다.
                봇 명령어 하나로 모집 공고가 올라가고, 참가자가 버튼으로 신청하면 캐릭터 정보와
                함께 명단이 자동으로 정리됩니다.
              </p>
              <p>
                매주 같은 멤버와 고정 레이드를 진행하는 길드나 파티에게 특히 유용합니다.
                요일별 고정 레이드를 등록해두면 매주 수요일 오전에 주간 일정을 자동 공지하고,
                레이드 당일 새벽에는 참가자에게 개인 DM으로 알림을 보내드립니다.
              </p>
            </div>
          </Section>

          {/* 시작하기 */}
          <Section title="시작하기">
            <SubSection title="1단계. 디스코드 서버에 로미니 봇 초대">
              <BulletList items={[
                "서버 관리자 권한이 있는 Discord 서버에 봇을 초대합니다.",
                "초대 링크는 로미니 홈페이지의 '봇 추가하기' 버튼을 통해 접근할 수 있습니다.",
                "봇 초대 시 채널 관리, 메시지 전송, 음성채널 관리 권한을 허용해야 합니다.",
                "봇이 메시지를 보낼 채널과 레이드 생성 채널을 봇 설정 페이지에서 지정합니다.",
              ]} />
            </SubSection>

            <SubSection title="2단계. Discord 로그인 및 캐릭터 연동">
              <BulletList items={[
                "로미니 웹사이트에서 'Discord로 시작하기' 버튼을 눌러 로그인합니다.",
                "로그인 후 상단 메뉴의 '캐릭터 연동'에서 로스트아크 닉네임을 입력합니다.",
                "로스트아크 API를 통해 직업, 아이템 레벨, 전투력 등 캐릭터 정보가 자동으로 불러와집니다.",
                "원정대 내 여러 캐릭터 중 레이드에 사용할 캐릭터를 선택하여 등록할 수 있습니다.",
                "캐릭터 정보는 레이드 참가 시 자동으로 표시되어 파티 구성에 활용됩니다.",
              ]} />
            </SubSection>

            <SubSection title="3단계. 첫 레이드 생성">
              <BulletList items={[
                "Discord 채널에서 /모집 명령어를 입력하거나 웹 대시보드에서 '레이드 생성'을 선택합니다.",
                "레이드 이름, 날짜, 시간, 인원(딜러/서포터 비율)을 설정합니다.",
                "생성된 모집 공고가 설정한 Discord 채널에 자동으로 게시됩니다.",
                "공고 메시지의 버튼을 통해 서버 멤버들이 직접 참가 신청을 할 수 있습니다.",
              ]} />
            </SubSection>
          </Section>

          {/* 주요 기능 */}
          <Section title="주요 기능">
            <SubSection title="슬래시 커맨드">
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <div className="divide-y divide-white/5">
                  <CommandBadge cmd="/모집" desc="레이드 모집 등록. 날짜, 시간, 레이드 종류, 인원을 설정하면 Discord 채널에 공고가 올라갑니다." />
                  <CommandBadge cmd="/모바출모집" desc="모바일 출전용 모집. 날짜 없이 즉시 모집 공고를 올릴 수 있습니다." />
                  <CommandBadge cmd="/참가" desc="원하는 레이드에 딜러 또는 서포터로 참가 신청합니다." />
                  <CommandBadge cmd="/같이참가" desc="깐부와 함께 동시에 참가 신청합니다." />
                  <CommandBadge cmd="/지난레이드삭제" desc="완료된 과거 레이드를 일괄 정리합니다." />
                </div>
              </div>
            </SubSection>

            <SubSection title="N수 레이드 (기차 레이드)">
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                같은 레이드를 여러 캐릭터로 2~4회 반복 진행하는 N수 레이드를 지원합니다.
                참가자별로 몇 수까지 참가할지 설정할 수 있으며, 회차별 인원이 자동으로 관리됩니다.
                기차 레이드는 웹 대시보드의 '레이드 생성'에서 생성할 수 있습니다.
              </p>
              <BulletList items={[
                "2수·3수·4수 기차 레이드 지원",
                "회차별 딜러/서포터 인원 자동 계산",
                "참가자별 캐릭터 배정 관리",
              ]} />
            </SubSection>

            <SubSection title="고정 레이드 관리">
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                매주 반복되는 정기 레이드 일정을 요일별로 등록하고 관리할 수 있습니다.
                한 번 설정해두면 매주 자동으로 알림이 발송됩니다.
              </p>
              <BulletList items={[
                "요일별 고정 레이드 등록 및 슬롯 관리",
                "수요일 오전 10시: 이번 주 전체 고정 레이드 일정 자동 공지",
                "레이드 당일 자정: 해당 레이드 참가자에게 개인 DM 알림 발송",
                "'다음주만' 임시 시간 변경 기능 (정기 일정은 유지)",
                "서버별 독립 관리 — 서버마다 별도의 고정 레이드 운영 가능",
              ]} />
            </SubSection>

            <SubSection title="캐릭터 연동 및 숙련도 표시">
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                참가자의 캐릭터 정보와 숙련도를 레이드 공고에 함께 표시하여
                파티 구성 시 참고할 수 있습니다.
              </p>
              <BulletList items={[
                "직업, 아이템 레벨, 전투력 자동 표시",
                "숙련도 선택: 헤딩 / 트라이 / 클경 / 반숙 / 숙련 / 숙제",
                "로스트아크 API 연동으로 캐릭터 정보 자동 갱신 가능",
              ]} />
            </SubSection>

            <SubSection title="음성채널 자동 관리">
              <BulletList items={[
                "레이드 출발 버튼 클릭 시 Discord 음성채널을 자동으로 생성합니다.",
                "생성된 채널명은 레이드 이름으로 자동 설정됩니다.",
                "모든 멤버가 퇴장하면 3시간 후 채널이 자동으로 삭제됩니다.",
                "봇 설정에서 음성채널 자동 생성 기능을 끄고 켤 수 있습니다.",
              ]} />
            </SubSection>

            <SubSection title="레이드 시작 전 DM 알림">
              <BulletList items={[
                "레이드 시작 10분 / 20분 / 30분 전에 참가자 전원에게 DM을 발송합니다.",
                "DM에는 레이드 이름, 날짜, 시간, 참가자 명단이 포함됩니다.",
                "주최자에게는 추가로 음성채널 링크가 포함됩니다.",
              ]} />
            </SubSection>
          </Section>

          {/* FAQ */}
          <Section title="자주 묻는 질문 (FAQ)">
            <div className="space-y-4">
              <FaqItem
                q="로미니는 무료인가요?"
                a="네, 모든 기능을 무료로 이용할 수 있습니다. 서비스 운영을 위한 자발적 후원을 받고 있으며 후원 여부와 관계없이 동일한 기능이 제공됩니다."
              />
              <FaqItem
                q="봇을 초대하려면 어떤 권한이 필요한가요?"
                a="Discord 서버의 관리자 권한이 필요합니다. 봇 자체에는 채널 메시지 전송, 채널 관리(음성채널 생성·삭제), DM 전송 권한이 필요합니다."
              />
              <FaqItem
                q="캐릭터 정보는 어떻게 갱신하나요?"
                a="웹 대시보드의 '캐릭터 연동' 페이지에서 캐릭터를 다시 연동하면 최신 아이템 레벨과 전투력으로 갱신됩니다. 로스트아크 API 기준으로 업데이트됩니다."
              />
              <FaqItem
                q="여러 Discord 서버에서 동시에 사용할 수 있나요?"
                a="네, 봇이 추가된 모든 서버에서 독립적으로 운영됩니다. 서버마다 별도의 채널 설정, 고정 레이드, 참가자 데이터가 관리됩니다."
              />
              <FaqItem
                q="레이드 공고가 특정 채널에 올라오지 않아요."
                a="봇 설정 페이지에서 '레이드 공고 채널'이 지정되어 있는지 확인해주세요. 채널이 설정되지 않으면 공고가 발송되지 않습니다. 또한 봇이 해당 채널에 메시지를 보낼 권한이 있는지도 확인해야 합니다."
              />
              <FaqItem
                q="고정 레이드 공지나 DM이 오지 않아요."
                a="봇 설정 페이지에서 '고정 레이드 공지'와 'DM 알림' 기능이 활성화되어 있는지 확인해주세요. 수요일 공지는 오전 10시경, 당일 DM은 자정에 발송됩니다."
              />
            </div>
          </Section>

        </div>

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-sm text-gray-500 mb-5">지금 바로 로미니를 시작해보세요.</p>
          <Link
            href="/"
            className="inline-block bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold px-8 py-3 rounded-xl transition-colors"
          >
            지금 시작하기
          </Link>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-gray-600">© 2026 로미니 (LostArk Raid Bot)</p>
        </div>
      </div>
    </div>
  )
}
