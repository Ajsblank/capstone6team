import React from "react";
import "./ChitoBattleProblem.css";

const ChitoBattleProblem: React.FC = () => {
  return (
    <div className="prob">
      {/* 제목 */}
      <div className="prob-header">
        <h1 className="prob-title">치토 배틀</h1>
      </div>

      {/* 맵 미리보기 */}
      <section className="prob-section">
        <div className="map-preview">
          <div className="map-grid">
            <div className="map-cell map-cell--player">내 캐릭터 위치</div>
            <div className="map-cell" />
            <div className="map-cell" />
            <div className="map-cell map-cell--opponent">상대 캐릭터 위치</div>
          </div>
        </div>
      </section>

      {/* 문제 설명 */}
      <section className="prob-section">
        <h2>문제 설명</h2>
        <p>치토들이 배틀을 하기로 하였습니다.</p>
      </section>

      {/* 게임 규칙 */}
      <section className="prob-section">
        <h2>게임 규칙</h2>
        <ul>
          <li>플레이어는 맵 기준으로 왼쪽에서, 상대는 맵 기준으로 오른쪽에서 시작합니다.</li>
          <li>상대의 좌, 우 이동은 반전된 결과로 주어집니다. (예: 상대가 오른쪽으로 이동하면 내 기준 왼쪽으로 이동합니다.)</li>
          <li>게임 시작 시 <b>[캐릭터]</b> 하나와 <b>[선택 카드]</b> 5장 중 3장을 선택합니다. 상대방의 [선택 카드]는 공개되지 않습니다.</li>
          <li>플레이어는 <b>[캐릭터 카드]</b> 5장 + <b>[공용 카드]</b> 6장 + <b>[선택 카드]</b> 3장을 보유합니다.</li>
          <li>플레이어는 각 라운드마다 보유한 카드 중 3장을 골라 순서대로 배열하여 상대방과 대결합니다.</li>
          <li>각 라운드는 배열한 카드 순서대로 동작하며, 3번의 턴 후 한 라운드가 종료됩니다. 턴은 서로의 카드 우선 순서대로 동작하며, 우선 순위가 같은 경우 동시에 실행된 것으로 간주합니다. (예시: 동시에 두 플레이어가 죽을 경우 무승부가 됩니다.)</li>
          <li>각 라운드에서 두 플레이어의 모든 턴이 끝날 때마다 맵 타일 중 일부가 t턴 동안 <b>[특수 타일]</b>로 변합니다.</li>
          <li>일반적인 우선 순위는 다음과 같습니다: <b>[이동]</b> &gt; <b>[방어]</b> &gt; <b>[공격]</b></li>
          <li>라운드가 끝나면 양측과 상대방의 마나가 15 회복됩니다.</li>
          <li>카드를 사용한 이후 체력이 0 이하가 되면 플레이어가 패배하게 됩니다.</li>
          <li>올바르지 않은 출력을 할 경우 패배하게 됩니다.</li>
        </ul>
      </section>

      {/* 입/출력 형식 */}
      <section className="prob-section">
        <h2>입/출력 형식</h2>
        <p className="prob-desc">
          참가자의 프로그램은 한 줄씩 입력을 받아 각 명령에 따라 동작해야 합니다.
          출력이 필요한 명령은 아래 표에서 <span className="highlight">빨간색</span>으로 표시되어 있습니다.
        </p>
        <div className="table-wrap">
          <table className="prob-table">
            <thead>
              <tr>
                <th>커맨드</th>
                <th>입력 형식</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              <tr className="row-output">
                <td>READY</td>
                <td>READY</td>
                <td>입력 준비 완료를 의미하며 <b>[캐릭터] [선택 카드0] [선택 카드1] [선택 카드2]</b>를 3초 이내에 출력해야 합니다.</td>
              </tr>
              <tr>
                <td>SELECT</td>
                <td>SELECT [캐릭터]</td>
                <td>상대가 선택한 캐릭터에 대한 정보를 알려주는 명령입니다.</td>
              </tr>
              <tr className="row-output">
                <td>SET</td>
                <td>SET [카드0] [카드1] [카드2]</td>
                <td>자신이 선택한 카드를 순서대로 출력하는 명령입니다. n초 이내에 출력해야 합니다.</td>
              </tr>
              <tr>
                <td>OPP</td>
                <td>OPP [카드0] [카드1] [카드2]</td>
                <td>상대가 이 라운드에 선택한 카드를 순서대로 알려주는 명령입니다.</td>
              </tr>
              <tr>
                <td>TILE</td>
                <td>[특수 타일]</td>
                <td>다음 라운드부터 변화가 일어나는 타일의 정보를 알려주는 명령입니다.</td>
              </tr>
              <tr>
                <td>FINISH</td>
                <td>FINISH</td>
                <td>게임 종료를 알리는 명령입니다. 이 명령을 받으면 프로그램이 정상적으로 종료되어야 하며, 출력을 하지 않습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 특수 타일 */}
      <section className="prob-section">
        <h2>특수 타일</h2>
        <ul>
          <li><code>[DAM_n r c t]</code> : 해당 타일에서 공격 스킬을 사용할 경우 입력 X n (버림)의 입력을 추가로 줍니다. (0.93 ~ 1.07)</li>
          <li><code>[MANA_n r c t]</code> : 마나를 n만큼 추가로 사용 / 회복합니다. (-7 ~ 7)</li>
          <li><code>[HP_n r c t]</code> : 해당 타일에서 행동을 할 경우, 절대적 체력을 n 변화시킵니다. (-7 ~ 7)</li>
          <li><code>[LINK r1 c1 r2 c2 t]</code> : r1, c1 타일과 r2, c2 타일에 적용되는 효과는 공유됩니다.</li>
          <li><code>[CONFUSION r c t]</code> : 해당 타일에서 스킬 카드가 랜덤 스킬 카드로 변환됩니다. 마나 소모는 기존의 카드를 기준으로 합니다.</li>
          <li><code>[TILE_UP r c t]</code> : t턴 동안 r, c 타일로 이동할 수 없습니다.</li>
        </ul>
      </section>

      {/* 공용 카드 */}
      <section className="prob-section">
        <h2>공용 카드</h2>
        <div className="card-group">
          <div className="card-item">
            <span className="card-name">[UP] / [DOWN] / [LEFT] / [RIGHT]</span>
            <span className="card-tag card-tag--move">이동</span>
            <p>기본적으로 캐릭터의 위치를 이동할 때 사용되는 카드. 다른 어떤 행동보다 최우선으로 발동됩니다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[GUARD]</span>
            <span className="card-tag card-tag--def">방어</span>
            <p>현재 위치에서 움직이지 않고 공격을 막아 피해를 15 줄인다. 공격보다 우선해 발동됩니다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[MANA_HEAL]</span>
            <span className="card-tag card-tag--heal">회복</span>
            <p>마나를 15 회복한다.</p>
          </div>
        </div>
      </section>

      {/* 선택 카드 */}
      <section className="prob-section">
        <h2>선택 카드</h2>
        <div className="card-group">
          <div className="card-item">
            <span className="card-name">[DOUBLE_RIGHT]</span>
            <p>오른쪽으로 2칸 이동한다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[DOUBLE_LEFT]</span>
            <p>왼쪽으로 2칸 이동한다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[HEAL]</span>
            <p>마나 60을 소비하고 체력을 40 회복한다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[PERFECT_GUARD]</span>
            <p>마나를 25 소모하고 공격을 완벽하게 막을 수 있다.</p>
          </div>
          <div className="card-item">
            <span className="card-name">[R] — 궁극기</span>
            <p>입력: 80 / 마나: 100</p>
          </div>
        </div>
      </section>

      {/* 예제 인터페이스 */}
      <section className="prob-section">
        <h2>예제 인터페이스</h2>
        <div className="table-wrap">
          <table className="prob-table prob-table--small">
            <thead>
              <tr>
                <th>플레이어 입력</th>
                <th>플레이어 출력</th>
                <th>상대방 입력</th>
                <th>상대방 출력</th>
                <th>로그</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="row-output">READY</td>
                <td>001 DOUBLE_RIGHT HEAL R</td>
                <td className="row-output">READY</td>
                <td>002 HEAL PERFECT_GUARD R</td>
                <td></td>
              </tr>
              <tr>
                <td>SELECT 002</td>
                <td></td>
                <td>SELECT 001</td>
                <td></td>
                <td>ROUND 1 ROLL 35561 15336</td>
              </tr>
              <tr>
                <td></td>
                <td className="row-output">SET RIGHT 001_A 001_B</td>
                <td></td>
                <td className="row-output">SET RIGHT UP 002_D</td>
                <td></td>
              </tr>
              <tr>
                <td>OPP LEFT UP 002_D</td>
                <td></td>
                <td>OPP LEFT 001_A 001_B</td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>TILE DAM_-7 0 2 6</td>
                <td></td>
                <td>TILE DAM_-7 2 1 6</td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td></td>
                <td className="row-output">SET GUARD DOUBLE_RIGHT 001_B</td>
                <td></td>
                <td className="row-output">SET PERFECT_GUARD MANA_HEAL R</td>
                <td></td>
              </tr>
              <tr>
                <td>OPP PERFECT_GUARD MANA_HEAL R</td>
                <td></td>
                <td>OPP GUARD DOUBLE_RIGHT 001_B</td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>TILE CONFUSION 1 1 4</td>
                <td></td>
                <td>TILE CONFUSION 1 2 4</td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={5} className="row-skip">(라운드 생략)</td>
              </tr>
              <tr>
                <td>FINISH</td>
                <td>(프로그램 종료)</td>
                <td>FINISH</td>
                <td>(프로그램 종료)</td>
                <td>FINISH</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 샘플 코드 */}
      <section className="prob-section">
        <h2>예제 코드</h2>
        <p>각 언어별로 작성한 예제 코드가 제공됩니다.</p>
        <ul>
          <li>C++20: <code>sample_code.cpp</code></li>
          <li>OpenJDK Java 21: <code>Main.java</code></li>
          <li>PyPy3 / Python3: <code>sample_code.py</code></li>
        </ul>
      </section>

      {/* 시각화 도구 */}
      <section className="prob-section">
        <h2>시각화 도구</h2>
        <ul>
          <li>[1인칭 플레이]</li>
          <li>[VS 배틀 코드]</li>
          <li>[로그 분석]</li>
        </ul>
      </section>
    </div>
  );
};

export default ChitoBattleProblem;
