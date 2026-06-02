import Link from "next/link"

export const metadata = {
  title: "개인정보처리방침 | 로미니",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10">
          ← 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">최종 수정일: 2026년 6월 1일</p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-3">1. 개요</h2>
            <p>
              로미니 (LostArk Raid Bot, 이하 "서비스")는 이용자의 개인정보를 소중히 여기며,
              관련 법령을 준수하여 개인정보를 처리합니다. 본 방침은 서비스가 수집·이용·보관·파기하는
              개인정보의 처리 기준을 안내합니다.
            </p>
            <ul className="mt-3 space-y-1 text-gray-400">
              <li>· 서비스명: 로미니 (LostArk Raid Bot)</li>
              <li>· 운영자: 이경민</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">2. 수집하는 개인정보 항목</h2>
            <p className="mb-3">서비스 이용 시 아래 정보가 수집됩니다.</p>
            <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="px-4 py-3 text-left font-medium">항목</th>
                    <th className="px-4 py-3 text-left font-medium">수집 경로</th>
                    <th className="px-4 py-3 text-left font-medium">필수 여부</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["Discord 사용자 ID", "Discord OAuth 로그인", "필수"],
                    ["Discord 사용자명", "Discord OAuth 로그인", "필수"],
                    ["Discord 프로필 아바타", "Discord OAuth 로그인", "선택"],
                    ["로스트아크 캐릭터명", "이용자 직접 입력", "선택"],
                    ["직업·아이템 레벨·전투력", "로스트아크 API 조회", "선택"],
                  ].map(([item, source, required]) => (
                    <tr key={item}>
                      <td className="px-4 py-3 text-gray-300">{item}</td>
                      <td className="px-4 py-3 text-gray-400">{source}</td>
                      <td className="px-4 py-3 text-gray-400">{required}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">3. 개인정보 수집·이용 목적</h2>
            <ul className="space-y-2 text-gray-400">
              <li>· 레이드 모집 및 참가 관리 서비스 제공</li>
              <li>· Discord 서버 내 레이드 공고 및 알림 발송</li>
              <li>· 캐릭터 정보 연동 및 참가 자격 확인</li>
              <li>· 서비스 이용 통계 및 품질 개선</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">4. 개인정보 보유 및 이용 기간</h2>
            <p className="text-gray-400">
              이용자가 서비스 탈퇴를 요청하거나 개인정보 삭제를 요청할 때까지 보유합니다.
              단, 관련 법령에 의해 보존 의무가 있는 경우 해당 기간 동안 보관할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">5. 개인정보의 제3자 제공</h2>
            <p className="text-gray-400">
              서비스는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.
              다만, 이용자의 사전 동의가 있거나 법령의 규정에 따른 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">6. 개인정보 처리 위탁</h2>
            <ul className="space-y-1 text-gray-400">
              <li>· MongoDB Atlas (데이터베이스 저장): MongoDB, Inc.</li>
              <li>· Discord (OAuth 인증): Discord Inc.</li>
              <li>· Vercel (서비스 호스팅): Vercel Inc.</li>
            </ul>
            <p className="mt-3 text-gray-500 text-xs">위 수탁사들은 서비스 제공 목적 범위 내에서만 개인정보를 처리합니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">7. 이용자의 권리</h2>
            <p className="mb-2 text-gray-400">이용자는 언제든지 아래 권리를 행사할 수 있습니다.</p>
            <ul className="space-y-1 text-gray-400">
              <li>· 개인정보 열람 요청</li>
              <li>· 개인정보 수정·삭제 요청</li>
              <li>· 개인정보 처리 정지 요청</li>
            </ul>
            <p className="mt-3 text-gray-400">권리 행사는 서비스 내 Discord 봇을 통해 문의하시거나, Discord 계정을 통해 직접 로그인 후 탈퇴 처리할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">8. 쿠키 및 자동 수집 정보</h2>
            <p className="text-gray-400">
              서비스는 로그인 세션 유지를 위해 세션 쿠키를 사용합니다.
              브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-3">9. 개인정보 보호책임자 및 문의</h2>
            <p className="text-gray-400">
              개인정보 처리에 관한 문의는 서비스 내 Discord 봇을 통해 문의해주세요.
              개인정보 관련 불만이나 피해 구제는{" "}
              <span className="text-gray-300">개인정보보호위원회 (privacy.go.kr)</span> 또는{" "}
              <span className="text-gray-300">한국인터넷진흥원 (kisa.or.kr)</span>에 신청하실 수 있습니다.
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
