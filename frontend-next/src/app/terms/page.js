import Link from "next/link"

export const metadata = {
  title: "이용약관 | 로미니",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          ← 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">최종 수정일: 2026년 6월 1일</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-3">제1조 (목적)</h2>
            <p className="text-gray-400">
              본 약관은 로미니 (LostArk Raid Bot, 이하 "서비스")의 이용 조건 및 절차,
              운영자와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제2조 (서비스 정의)</h2>
            <ul className="space-y-2 text-gray-400">
              <li>· 서비스명: 로미니 (LostArk Raid Bot)</li>
              <li>· 운영자: 이경민</li>
              <li>· 서비스 목적: 로스트아크 레이드 모집 및 파티 관리를 Discord와 연동하여 제공</li>
              <li>· 서비스 URL: loaraid-discobot.vercel.app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제3조 (이용 조건)</h2>
            <p className="mb-3 text-gray-400">서비스를 이용하려면 다음 조건을 충족해야 합니다.</p>
            <ul className="space-y-2 text-gray-400">
              <li>· Discord 계정을 보유하고 있어야 합니다.</li>
              <li>· Discord OAuth 인증을 통해 로그인에 동의해야 합니다.</li>
              <li>· 본 약관 및 개인정보처리방침에 동의해야 합니다.</li>
              <li>· 만 14세 미만인 경우 법정대리인의 동의가 필요합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제4조 (서비스 이용)</h2>
            <ul className="space-y-2 text-gray-400">
              <li>· 서비스는 Discord 서버에 봇을 추가한 후 이용 가능합니다.</li>
              <li>· 레이드 모집, 참가, 캐릭터 연동 등의 기능을 제공합니다.</li>
              <li>· 일부 기능은 Discord 서버 관리자 권한이 필요할 수 있습니다.</li>
              <li>· 서비스는 무료로 제공되며, 후원은 자발적 의사에 따릅니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제5조 (금지 행위)</h2>
            <p className="mb-3 text-gray-400">이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ul className="space-y-2 text-gray-400">
              <li>· 타인의 Discord 계정이나 캐릭터 정보를 무단으로 도용하는 행위</li>
              <li>· 서비스를 이용하여 타인을 사기, 기망, 명예훼손하는 행위</li>
              <li>· 서비스의 정상적인 운영을 방해하는 행위 (자동화 스크립트, 대량 요청 등)</li>
              <li>· 서비스를 통해 수집한 타인의 정보를 무단으로 활용하는 행위</li>
              <li>· 관련 법령 및 Discord 이용약관을 위반하는 행위</li>
              <li>· 기타 운영자가 부적절하다고 판단하는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제6조 (서비스 변경 및 중단)</h2>
            <ul className="space-y-2 text-gray-400">
              <li>· 운영자는 서비스의 내용·기능을 언제든지 변경하거나 중단할 권리를 보유합니다.</li>
              <li>· 서비스 중단 시 사전 공지를 원칙으로 하되, 긴급한 경우 사후 공지할 수 있습니다.</li>
              <li>· 서비스 중단으로 인한 이용자의 손해에 대해 운영자는 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제7조 (책임 제한)</h2>
            <ul className="space-y-2 text-gray-400">
              <li>· 서비스는 로스트아크 게임 데이터를 API를 통해 제공하며, 데이터의 정확성을 보증하지 않습니다.</li>
              <li>· Discord 플랫폼의 장애로 인한 서비스 중단에 대해 운영자는 책임을 지지 않습니다.</li>
              <li>· 이용자 간의 분쟁에 운영자는 개입하지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제8조 (약관 변경)</h2>
            <p className="text-gray-400">
              운영자는 필요한 경우 약관을 변경할 수 있으며, 변경 시 서비스 내에서 공지합니다.
              변경된 약관은 공지 후 7일이 지나면 효력이 발생합니다.
              변경에 동의하지 않는 이용자는 서비스 이용을 중단할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">제9조 (준거법 및 관할)</h2>
            <p className="text-gray-400">
              본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.
              서비스 이용과 관련한 분쟁은 대한민국 법원을 관할 법원으로 합니다.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-gray-600">© 2026 로미니 (LostArk Raid Bot)</p>
        </div>
      </div>
    </div>
  )
}
