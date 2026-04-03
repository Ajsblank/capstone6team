#include <iostream>
#include <string>
#include <unistd.h>
#include <sys/wait.h>
#include <cstring>
#include <vector>
#include <cassert>
#include <unordered_map>
#include <algorithm>
#include <sys/resource.h>

using namespace std;

// 특수타일 종류들을 나타내는 enum
enum Tile
{
    NORMAL, POWER, HP_FLUX, MANA_FLUX, LINK, CHAOS, LOCK,
};

// 가능한 캐릭터 종류들을 나타내는 enum
enum Character
{
    c001, c002, c003, c004, c005, c006, c007, c008
};

// 가능한 카드 종류들을 나타내는 enum
enum Card
{
    // 이동 카드
    UP, DOWN, LEFT, RIGHT, DOUBLE_LEFT, DOUBLE_RIGHT,

    // 유틸 카드
    HEAL, MANA_HEAL, GUARD, PERFECT_GUARD,

    // 공격 카드
    R,
    c001_A, c001_B, c001_C, c001_D, c001_E,
    c002_A, c002_B, c002_C, c002_D, c002_E,
    c003_A, c003_B, c003_C, c003_D, c003_E,
    c004_A, c004_B, c004_C, c004_D, c004_E,
    c005_A, c005_B, c005_C, c005_D, c005_E,
    c006_A, c006_B, c006_C, c006_D, c006_E,
    c007_A, c007_B, c007_C, c007_D, c007_E,
    c008_A, c008_B, c008_C, c008_D, c008_E,
};

// ============================================================
// ========= [입출력을 위한 enum <-> string 변환 함수 ]==========
// ============================================================
string EnumToString(Tile tile)
{
    switch(tile)
    {
        case NORMAL: return "NORMAL";
        case POWER: return "POWER";
        case HP_FLUX: return "HP_FLUX";
        case MANA_FLUX: return "MANA_FLUX";
        case LINK: return "LINK";
        case CHAOS: return "CHAOS";
        case LOCK: return "LOCK";
    }
    assert(!"Invalid Tile");
}

string EnumToString(Character character)
{
    switch(character)
    {
        case c001: return "c001";
        case c002: return "c002";
        case c003: return "c003";
        case c004: return "c004";
        case c005: return "c005";
        case c006: return "c006";
        case c007: return "c007";
        case c008: return "c008";
    }
    assert(!"Invalid Character");
}

string EnumToString(Card card)
{
    switch(card)
    {
        // 이동 카드
        case UP: return "UP";
        case DOWN: return "DOWN";
        case LEFT: return "LEFT";
        case RIGHT: return "RIGHT";
        case DOUBLE_LEFT: return "DOUBLE_LEFT";
        case DOUBLE_RIGHT: return "DOUBLE_RIGHT";

        // 유틸 카드
        case HEAL: return "HEAL";
        case MANA_HEAL: return "MANA_HEAL";
        case GUARD: return "GUARD";
        case PERFECT_GUARD: return "PERFECT_GUARD";

        // 스킬 카드
        case R: return "R";
        case c001_A: return "c001_A"; case c001_B: return "c001_B"; case c001_C: return "c001_C"; case c001_D: return "c001_D"; case c001_E: return "c001_E";
        case c002_A: return "c002_A"; case c002_B: return "c002_B"; case c002_C: return "c002_C"; case c002_D: return "c002_D"; case c002_E: return "c002_E";
        case c003_A: return "c003_A"; case c003_B: return "c003_B"; case c003_C: return "c003_C"; case c003_D: return "c003_D"; case c003_E: return "c003_E";
        case c004_A: return "c004_A"; case c004_B: return "c004_B"; case c004_C: return "c004_C"; case c004_D: return "c004_D"; case c004_E: return "c004_E";
        case c005_A: return "c005_A"; case c005_B: return "c005_B"; case c005_C: return "c005_C"; case c005_D: return "c005_D"; case c005_E: return "c005_E";
        case c006_A: return "c006_A"; case c006_B: return "c006_B"; case c006_C: return "c006_C"; case c006_D: return "c006_D"; case c006_E: return "c006_E";
        case c007_A: return "c007_A"; case c007_B: return "c007_B"; case c007_C: return "c007_C"; case c007_D: return "c007_D"; case c007_E: return "c007_E";
        case c008_A: return "c008_A"; case c008_B: return "c008_B"; case c008_C: return "c008_C"; case c008_D: return "c008_D"; case c008_E: return "c008_E";
    }
    assert(!"Invalid Card");
}

template <typename T>
T StringToEnum(const string& str)
{
    if constexpr (is_same_v<T, Tile>)
    {
        if (str == "NORMAL") return NORMAL;
        if (str == "POWER") return POWER;
        if (str == "HP_FLUX") return HP_FLUX;
        if (str == "MANA_FLUX") return MANA_FLUX;
        if (str == "LINK") return LINK;
        if (str == "CHAOS") return CHAOS;
        if (str == "LOCK") return LOCK;
    }
    else if constexpr (is_same_v<T, Character>)
    {
        if (str == "c001") return c001;
        if (str == "c002") return c002;
        if (str == "c003") return c003;
        if (str == "c004") return c004;
        if (str == "c005") return c005;
        if (str == "c006") return c006;
        if (str == "c007") return c007;
        if (str == "c008") return c008;
    }
    else if constexpr (is_same_v<T, Card>)
    {
        if (str == "UP") return UP;
        if (str == "DOWN") return DOWN;
        if (str == "LEFT") return LEFT;
        if (str == "RIGHT") return RIGHT;
        if (str == "DOUBLE_LEFT") return DOUBLE_LEFT;
        if (str == "DOUBLE_RIGHT") return DOUBLE_RIGHT;

        if (str == "HEAL") return HEAL;
        if (str == "MANA_HEAL") return MANA_HEAL;
        if (str == "GUARD") return GUARD;
        if (str == "PERFECT_GUARD") return PERFECT_GUARD;

        if (str == "R") return R;
        if (str == "c001_A") return c001_A; if (str == "c001_B") return c001_B; if (str == "c001_C") return c001_C; if (str == "c001_D") return c001_D; if (str == "c001_E") return c001_E;
        if (str == "c002_A") return c002_A; if (str == "c002_B") return c002_B; if (str == "c002_C") return c002_C; if (str == "c002_D") return c002_D; if (str == "c002_E") return c002_E;
        if (str == "c003_A") return c003_A; if (str == "c003_B") return c003_B; if (str == "c003_C") return c003_C; if (str == "c003_D") return c003_D; if (str == "c003_E") return c003_E;
        if (str == "c004_A") return c004_A; if (str == "c004_B") return c004_B; if (str == "c004_C") return c004_C; if (str == "c004_D") return c004_D; if (str == "c004_E") return c004_E;
        if (str == "c005_A") return c005_A; if (str == "c005_B") return c005_B; if (str == "c005_C") return c005_C; if (str == "c005_D") return c005_D; if (str == "c005_E") return c005_E;
        if (str == "c006_A") return c006_A; if (str == "c006_B") return c006_B; if (str == "c006_C") return c006_C; if (str == "c006_D") return c006_D; if (str == "c006_E") return c006_E;
        if (str == "c007_A") return c007_A; if (str == "c007_B") return c007_B; if (str == "c007_C") return c007_C; if (str == "c007_D") return c007_D; if (str == "c007_E") return c007_E;
        if (str == "c008_A") return c008_A; if (str == "c008_B") return c008_B; if (str == "c008_C") return c008_C; if (str == "c008_D") return c008_D; if (str == "c008_E") return c008_E;
    }
    assert(!"Invalid Value");
}
// ============================================================

// CENTER, UP, UP_RIGHT, RIGHT, DOWN_RIGHT, DOWN, DOWN_LEFT, LEFT, UP_LEFT
int dir[9][2] = {{0,0},{-1,0},{-1,1},{0,1},{1,1},{1,0},{1,-1},{0,-1},{-1,-1},};

// 카드의 고유 속성을 담는 구조체
struct SkillCardInfo
{
    string name;        // 카드 이름
    int damage;         // 가하는 데미지
    int mana;           // 소모 마나
    bool range[9];      // 범위
};

// 게임 내 모든 카드의 능력치를 저장하는 읽기 전용 데이터베이스
const unordered_map<Card, SkillCardInfo> SkillCardMap = {
    
    // R
    { R,      { "R",     80, 100,{ true, false, false, false, false, false, false, false, false } } },

    // [c001 캐릭터]
    { c001_A, { "001_A", 30, 25, { true,  true, false, false, false,  true, false, false, false } } },
    { c001_B, { "001_B", 50, 50, { true, false, false, false,  true,  true,  true, false, false } } },
    { c001_C, { "001_C", 25, 25, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c001_D, { "001_D", 25, 35, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c001_E, { "001_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c002 캐릭터]
    { c002_A, { "002_A", 50, 50, { true, false,  true, false, false, false, false, false,  true } } },
    { c002_B, { "002_B", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c002_C, { "002_C", 25, 15, { true, false, false,  true, false, false, false,  true, false } } },
    { c002_D, { "002_D", 25, 25, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c002_E, { "002_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c003 캐릭터]
    { c003_A, { "003_A", 40, 45, { true, false, false,  true, false, false, false,  true, false } } },
    { c003_B, { "003_B", 25, 30, { true,  true,  true, false,  true,  true,  true, false,  true } } },
    { c003_C, { "003_C", 15, 25, {false, false,  true,  true,  true, false,  true,  true,  true } } },
    { c003_D, { "003_D", 30, 20, { true,  true, false, false, false,  true, false, false, false } } },
    { c003_E, { "003_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c004 캐릭터]
    { c004_A, { "004_A", 50, 50, { true,  true,  true, false, false, false, false, false,  true } } },
    { c004_B, { "004_B", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c004_C, { "004_C", 25, 35, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c004_D, { "004_D", 25, 20, { true, false, false,  true, false, false, false,  true, false } } },
    { c004_E, { "004_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c005 캐릭터]
    { c005_A, { "005_A", 40, 50, { true, false,  true,  true,  true, false,  true,  true,  true } } },
    { c005_B, { "005_B", 25, 30, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c005_C, { "005_C", 25, 15, { true, false, false,  true, false, false, false,  true, false } } },
    { c005_D, { "005_D", 25, 30, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c005_E, { "005_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c006 캐릭터]
    { c006_A, { "006_A", 35, 25, { true, false, false,  true, false, false, false,  true, false } } },
    { c006_B, { "006_B", 50, 45, { true, false, false, false,  true,  true,  true, false, false } } },
    { c006_C, { "006_C", 25, 15, { true,  true, false,  true, false, false, false,  true, false } } },
    { c006_D, { "006_D", 20, 35, { true, false,  true,  true,  true, false,  true,  true,  true } } },
    { c006_E, { "006_E", 25, 40, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [c007 캐릭터]
    { c007_A, { "007_A", 40, 50, {false,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c007_B, { "007_B", 25, 25, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c007_C, { "007_C", 60, 50, { true, false, false, false, false,  true, false, false, false } } },
    { c007_D, { "007_D", 30, 20, { true, false, false,  true, false, false, false,  true, false } } },
    { c007_E, { "007_E", 25, 15, {false, false, false,  true,  true, false,  true,  true, false } } },

    // [c008 캐릭터]
    { c008_A, { "008_A", 60, 70, {false, false, false,  true, false, false, false,  true, false } } },
    { c008_B, { "008_B", 20, 15, { true, false, false,  true,  true,  true,  true,  true, false } } },
    { c008_C, { "008_C", 40, 50, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c008_D, { "008_D", 25, 20, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c008_E, { "008_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
};

// 카드의 방향을 점대칭(180도 회전)으로 변환
Card GetSymmetricCard(Card card)
{
    switch(card)
    {
        case UP: return DOWN;
        case DOWN: return UP;
        case LEFT: return RIGHT;
        case RIGHT: return LEFT;
        case DOUBLE_LEFT: return DOUBLE_RIGHT;
        case DOUBLE_RIGHT: return DOUBLE_LEFT;
        default: return card; // 공격 및 유틸 카드는 그대로
    }
}

// 타일의 좌표를 P2 시점(점대칭)으로 변환
TileState GetSymmetricTile(TileState tile)
{
    TileState sym = tile;
    sym.r = 2 - tile.r;
    sym.c = 3 - tile.c;
    if(tile.type == LINK) {
        sym.r1 = 2 - tile.r1;
        sym.c1 = 3 - tile.c1;
        sym.r2 = 2 - tile.r2;
        sym.c2 = 3 - tile.c2;
    }
    return sym;
}

class JudgeServer
{
public:
    int round = 1;
    TileState board[3][4];
    CharacterState p1, p2;

    JudgeServer() {
        p1.SetPosition(1, 0); // P1은 왼쪽
        p2.SetPosition(1, 3); // P2는 오른쪽
        
        // 보드 초기화
        for(int r=0; r<3; r++)
            for(int c=0; c<4; c++)
                board[r][c] = {NORMAL, 0, r, c, 0, 0, 0, 0, 0};
    }

    void SimulateRound(Behavior p1_behavior, Behavior p2_raw_behavior)
    {
        cout << "\n========== [ROUND " << round << "] ==========" << endl;
        
        // 로그 출력 (명세서 기준)
        cout << "[LOG] P1 SET: " << EnumToString(p1_behavior.card[0]) << " " << EnumToString(p1_behavior.card[1]) << " " << EnumToString(p1_behavior.card[2]) << endl;
        cout << "[LOG] P2 SET: " << EnumToString(p2_raw_behavior.card[0]) << " " << EnumToString(p2_raw_behavior.card[1]) << " " << EnumToString(p2_raw_behavior.card[2]) << endl;

        for (int i = 0; i < 3; i++)
        {
            Card c1 = p1_behavior.card[i];
            Card c2_raw = p2_raw_behavior.card[i];
            
            // P2의 카드를 절대 좌표계 카드로 변환
            Card c2 = GetSymmetricCard(c2_raw);

            // 행동 전 타일 효과 (MANA_FLUX)
            if (board[p1.r][p1.c].type == MANA_FLUX) p1.MP += board[p1.r][p1.c].n;
            if (board[p2.r][p2.c].type == MANA_FLUX) p2.MP += board[p2.r][p2.c].n;

            // 방어 상태 초기화 및 마나 지불
            p1.isGuard = p1.isPerfectGuard = false;
            p2.isGuard = p2.isPerfectGuard = false;
            
            int p1_cost = GetManaCost(c1);
            int p2_cost = GetManaCost(c2);
            
            // 마나가 부족하면 카드를 발동하지 못함
            // Todo : 패배처리
            bool p1_canAct = (p1.MP >= p1_cost);
            bool p2_canAct = (p2.MP >= p2_cost);
            
            if(p1_canAct) p1.MP -= p1_cost;
            if(p2_canAct) p2.MP -= p2_cost;

            // 이동 및 유틸 적용 (이동 > 방어)
            if(p1_canAct) ApplyMoveAndUtil(p1, c1, 1);
            if(p2_canAct) ApplyMoveAndUtil(p2, c2, -1);

            // 스킬 타격 동시 판정
            int p1_take_dmg = 0;
            int p2_take_dmg = 0;

            if(p1_canAct && c1 > PERFECT_GUARD) p2_take_dmg = CalculateDamage(p1, c1, p2, 1);
            if(p2_canAct && c2 > PERFECT_GUARD) p1_take_dmg = CalculateDamage(p2, c2, p1, -1);

            // HP 동시 차감
            p1.HP -= p1_take_dmg;
            p2.HP -= p2_take_dmg;

            // 타일 효과 (HP_FLUX) 적용 - 명세 "행동을 할 경우"
            if(p1_canAct && board[p1.r][p1.c].type == HP_FLUX) p1.HP += board[p1.r][p1.c].n;
            if(p2_canAct && board[p2.r][p2.c].type == HP_FLUX) p2.HP += board[p2.r][p2.c].n;

            // 타일 턴수 차감
            UpdateTiles();

            // 승패 판정 (중간에 체력이 0 이하면 즉시 종료)
            if (p1.HP <= 0 || p2.HP <= 0) break;
        }

        // 라운드 종료 후 마나 회복
        p1.MP = min(100, p1.MP + 15);
        p2.MP = min(100, p2.MP + 15);
        
        round++;
    }

    // 서버가 각 플레이어에게 OPP 명령어 데이터를 만들 때 사용
    void SendOppInfoToPlayers(Behavior p1_b, Behavior p2_raw_b)
    {
        // 점대칭된 카드를 줌
        cout << "[To P1] OPP " << EnumToString(GetSymmetricCard(p2_raw_b.card[0])) << " " << EnumToString(GetSymmetricCard(p2_raw_b.card[1])) << " " << EnumToString(GetSymmetricCard(p2_raw_b.card[2])) << endl;
        cout << "[To P2] OPP " << EnumToString(GetSymmetricCard(p1_b.card[0])) << " " << EnumToString(GetSymmetricCard(p1_b.card[1])) << " " << EnumToString(GetSymmetricCard(p1_b.card[2])) << endl;
    }
    
    // 서버가 특수 타일 발생 시 양측에 알림
    void BroadcastTile(TileState globalTile)
    {
        board[globalTile.r][globalTile.c] = globalTile; // 글로벌 보드 갱신
        
        TileState p2Tile = GetSymmetricTile(globalTile); // P2용 좌표 변환
        
        cout << "[To P1] TILE " << EnumToString(globalTile.type) << " " << globalTile.r << " " << globalTile.c << " " << globalTile.remainTurn << endl;
        cout << "[To P2] TILE " << EnumToString(p2Tile.type) << " " << p2Tile.r << " " << p2Tile.c << " " << p2Tile.remainTurn << endl;
    }

private:
    int GetManaCost(Card card) {
        if (card == HEAL) return 60;
        if (card == PERFECT_GUARD) return 25;
        if (card > PERFECT_GUARD) return SkillCardMap.at(card).mana;
        return 0;
    }

    // 이동 및 유틸 카드 적용 (방향 dirMultiplier : P1은 1, P2는 -1을 곱해서 점대칭 이동)
    void ApplyMoveAndUtil(CharacterState& ch, Card card, int dirMultiplier)
    {
        if (card <= DOUBLE_RIGHT) {
            int dr = 0, dc = 0;
            switch(card) {
                case UP: dr = -1; break;
                case DOWN: dr = 1; break;
                case LEFT: case DOUBLE_LEFT: dc = -1; break;
                case RIGHT: case DOUBLE_RIGHT: dc = 1; break;
            }
            
            int steps = (card == DOUBLE_LEFT || card == DOUBLE_RIGHT) ? 2 : 1;
            for(int s = 0; s < steps; s++) {
                int nr = ch.r + dr;
                int nc = ch.c + dc;
                if(nr >= 0 && nr < 3 && nc >= 0 && nc < 4 && board[nr][nc].type != LOCK) {
                    ch.r = nr; ch.c = nc;
                } else break; // 막히면 정지
            }
        } 
        else if (card <= PERFECT_GUARD) {
            switch(card) {
                case HEAL: ch.HP = min(100, ch.HP + 40); break;
                case MANA_HEAL: ch.MP = min(100, ch.MP + 15); break;
                case GUARD: ch.isGuard = true; break;
                case PERFECT_GUARD: ch.isPerfectGuard = true; break;
            }
        }
    }

    // 데미지 시뮬레이션 (적중 여부만 판단하고 데미지 수치 반환)
    int CalculateDamage(CharacterState& attacker, Card card, CharacterState& defender, int dirMultiplier)
    {
        SkillCardInfo info = SkillCardMap.at(card);
        int damage = info.damage;
        
        // POWER 타일 위력 버프
        if(board[attacker.r][attacker.c].type == POWER) {
            damage = damage * (100 + board[attacker.r][attacker.c].n) / 100;
        }

        bool hit = false;
        for(int i = 0; i < 9; i++) {
            if(info.range[i]) {
                // P1은 r+dr, P2는 r-dr (범위 판정도 180도 회전시켜야 함)
                int hitR = attacker.r + (dir[i][0] * dirMultiplier);
                int hitC = attacker.c + (dir[i][1] * dirMultiplier);
                
                if(hitR == defender.r && hitC == defender.c) {
                    hit = true; break;
                }
            }
        }

        if(hit) {
            if(defender.isPerfectGuard) return 0;
            if(defender.isGuard) damage = max(0, damage - 15);
            return damage;
        }
        return 0; // 빗나감
    }

    void UpdateTiles() {
        for(int r=0; r<3; r++) {
            for(int c=0; c<4; c++) {
                if(board[r][c].type != NORMAL) {
                    board[r][c].remainTurn--;
                    if(board[r][c].remainTurn <= 0) board[r][c].type = NORMAL;
                }
            }
        }
    }
};

struct Player {
    pid_t pid;
    int write_fd;
    int read_fd;
};

Player spawnPlayer(const char* command) {
    int pipe_to_child[2];
    int pipe_from_child[2];

    pipe(pipe_to_child);
    pipe(pipe_from_child);

    pid_t pid = fork();

    if (pid == 0) {

        struct rlimit cpu_limit;
        cpu_limit.rlim_cur = 2; // Soft limit (초 단위)
        cpu_limit.rlim_max = 2; // Hard limit
        setrlimit(RLIMIT_CPU, &cpu_limit);      // CPU 사용 시간 제한

        struct rlimit mem_limit;
        mem_limit.rlim_cur = 256 * 1024 * 1024; // Soft limit (바이트 단위)
        mem_limit.rlim_max = 256 * 1024 * 1024; // Hard limit
        setrlimit(RLIMIT_AS, &mem_limit);       // 가상 메모리 전체 크기 제한

        dup2(pipe_to_child[0], STDIN_FILENO);
        dup2(pipe_from_child[1], STDOUT_FILENO);

        close(pipe_to_child[0]);
        close(pipe_to_child[1]);
        close(pipe_from_child[0]);
        close(pipe_from_child[1]);

        execl(command, command, nullptr);
        
        cerr << "[Error] 프로그램을 실행할 수 없습니다: " << command << endl;
        exit(1);
    } else {
        close(pipe_to_child[0]);
        close(pipe_from_child[1]);

        return {pid, pipe_to_child[1], pipe_from_child[0]};
    }
}

string readLine(int fd) {
    string result = "";
    char c;
    while (read(fd, &c, 1) > 0) {
        if (c == '\n') break;
        if (c != '\r') result += c;
    }
    return result;
}

void writeLine(int fd, const string& msg) {
    string out = msg + "\n";
    write(fd, out.c_str(), out.length());
}

int main(int argc, char* argv[]) {

    // (채점코드, P1 코드, P2 코드)
    if (argc != 3) {
        cerr << "사용법: ./judge <Player1_code> <Player2_code>" << endl;
        cerr << "예시: ./judge ./pikachu_bot ./charmander_bot" << endl;
        return 1;
    }

    string p1_path = argv[1];
    string p2_path = argv[2];

    // 입력받은 코드 실행
    Player p1 = spawnPlayer(p1_path.c_str());
    Player p2 = spawnPlayer(p2_path.c_str());

    JudgeServer judge;
    string command;
    bool loseP1 = false, loseP2 = false;

    writeLine(p1.write_fd, "READY");
    writeLine(p2.write_fd, "READY");

    string p1_ready = readLine(p1.read_fd);
    string p2_ready = readLine(p2.read_fd);

    if (p1_ready.empty() || p2_ready.empty()) {
        cout << "[System] 플레이어 응답 없음 (런타임 에러)" << endl;
        return 1;
    }

    // 캐릭터 파싱
    stringstream ss1(p1_ready), ss2(p2_ready);
    string c1_str, c2_str;
    ss1 >> c1_str;
    ss2 >> c2_str;
    // Todo: 선택 카드 파싱
    judge.p1.character = StringToEnum<Character>(c1_str);
    judge.p2.character = StringToEnum<Character>(c2_str);

    // 상대방 캐릭터 알려주기
    writeLine(p1.write_fd, "SELECT " + c2_str);
    writeLine(p2.write_fd, "SELECT " + c1_str);

    while (judge.p1.HP > 0 && judge.p2.HP > 0) {
        cout << "\n--- Turn " << turn << " ---" << endl;
        
        writeLine(p1.write_fd, "SET");
        string p1_set = readLine(p1.read_fd);
        if (p1_set.empty()) {
            cout << "[System] 플레이어1 프로세스 비정상 종료." << endl;
            break;
        }
        Behavior b1;
        stringstream set1(p1_set);
        set1 >> command;
        if(command != "SET")
            loseP1 = true;
        for(int i = 0; i < 3; i++)
        {
            string s;
            set1 >> s;
            b1.card[i] = StringToEnum<Card>(s);
        }

        writeLine(p2.write_fd, "SET");
        string p1_set = readLine(p2.read_fd);
        if (p2_set.empty()) {
            cout << "[System] 플레이어2 프로세스 비정상 종료." << endl;
            break;
        }
        Behavior b2;
        stringstream set2(p2_set);
        set2 >> command;
        if(command != "SET")
            loseP2 = true;
        for(int i = 0; i < 3; i++)
        {
            string s;
            set2 >> s;
            b2.card[i] = StringToEnum<Card>(s);
        }

        string opp_for_p1 = "OPP " + EnumToString(GetSymmetricCard(b2.card[0])) + " " + EnumToString(GetSymmetricCard(b2.card[1])) + " " + EnumToString(GetSymmetricCard(b2.card[2]));
        string opp_for_p2 = "OPP " + EnumToString(GetSymmetricCard(b1.card[0])) + " " + EnumToString(GetSymmetricCard(b1.card[1])) + " " + EnumToString(GetSymmetricCard(b1.card[2]));

        writeLine(p1.write_fd, opp_for_p1);
        writeLine(p2.write_fd, opp_for_p2);
        
        judge.SimulateRound(b1, b2);
        if (judge.p1.HP <= 0 || judge.p2.HP <= 0) break;

        // Todo : 특수 타일 생성
    }

    cout << "\n[System] 배틀 종료!" << endl;
    if (p1_hp > p2_hp) cout << "Player 1 승리!" << endl;
    else if (p2_hp > p1_hp) cout << "Player 2 승리!" << endl;
    else cout << "무승부!" << endl;

    writeLine(p1.write_fd, "-1 -1");
    writeLine(p2.write_fd, "-1 -1");
    waitpid(p1.pid, nullptr, 0);
    waitpid(p2.pid, nullptr, 0);

    return 0;
}