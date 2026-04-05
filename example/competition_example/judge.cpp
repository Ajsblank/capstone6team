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
#include <type_traits>
#include <unordered_map>
#include <cstdlib>
#include <sstream>

using namespace std;

enum Result
{
    NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, ERROR
};
Result p1Result = WIN, p2Result = WIN;

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
string EnumToString(Result result)
{
    switch(result)
    {
        case NONE: return "NONE";
        case WIN: return "WIN";
        case LOSE: return "LOSE";
        case TIME_LIMIT: return "TIME_LIMIT";
        case MEMORY_LIMIT: return "MEMORY_LIMIT";
        case ERROR: return "ERROR";
    }
    throw invalid_argument("Invalid Result : " + result);
}

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
    throw invalid_argument("Invalid Tile : " + tile);
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
    throw invalid_argument("Invalid Character : " + character);
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
    throw invalid_argument("Invalid Card : " + card);
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
    else if constexpr (is_same_v<T, Result>)
    {
        if (str == "NONE") return NONE;
        if (str == "WIN") return WIN;
        if (str == "LOSE") return LOSE;
        if (str == "TIME_LIMIT") return TIME_LIMIT;
        if (str == "MEMORY_LIMIT") return MEMORY_LIMIT;
        if (str == "ERROR") return ERROR;
    }
    throw invalid_argument("Invalid String : " + str);
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

struct InitGame
{
    Character character;
    Card selectCard[3];
};

struct Behavior
{
    Card card[3];
};

struct TileState
{
    Tile type;
    int n, r, c, r1, c1, r2, c2;
    int remainTurn;
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

class CharacterState
{
public:
    Character character;    // 캐릭터 종류
    int r, c;   // 캐릭터 위치 (r, c)
    int HP, MP; // HP, MP
    bool isGuard = false;
    bool isPerfectGuard = false;
    CharacterState() {
        HP = 100;
        MP = 100;
    }

    void SetPosition(int _r, int _c)
    {
        r = _r;
        c = _c;
    }

    void ApplyCard(TileState board[3][4], Card myCard, Card oppCard, CharacterState& oppCharacter)
    {
        TileState tile = board[r][c];

        // HP, MP 관련 타일
        switch(tile.type)
        {
            case HP_FLUX:
                HP += tile.n;
                break;
            case MANA_FLUX:
                MP += tile.n;
                break;
        }

        if(myCard <= DOUBLE_RIGHT)   // 이동 카드
        {
            // 변화량
            int dr = 0, dc = 0;
            switch(myCard)
            {
                case UP: dr = -1; break;
                case DOWN: dr = 1; break;
                case LEFT: case DOUBLE_LEFT: dc = -1; break;
                case RIGHT: case DOUBLE_RIGHT: dc = 1; break;
            }
            // 첫 번째 칸 이동 (맵 범위 내 & LOCK 타일이 아닐 때)
            if(r+dr >= 0 && r+dr < 3 && c+dc >= 0 && c+dc < 4 && board[r+dr][c+dc].type != LOCK)
            {
                r += dr;
                c += dc;
            }
            // 두 번째 칸 이동 (DOUBLE 이동기일 때 한 번 더)
            if((myCard == DOUBLE_LEFT || myCard == DOUBLE_RIGHT) && r+dr >= 0 && r+dr < 3 && c+dc >= 0 && c+dc < 4 && board[r+dr][c+dc].type != LOCK)
            {
                r += dr;
                c += dc;
            }
        }
        else if(myCard <= PERFECT_GUARD)  // 유틸 카드
        {
            switch(myCard)
            {
                case HEAL:
                    HP = min(100, HP+40);
                    MP -= 60;
                    break;
                case MANA_HEAL:
                    MP = min(100, MP+15);
                    break;
                case GUARD:
                    isGuard = true;
                    break;
                case PERFECT_GUARD:
                    MP -= 25;
                    isPerfectGuard = true;
                    break;
            }
        }
        else    // 공격 카드
        {
            SkillCardInfo cardInfo = SkillCardMap.at(myCard);
            int damage = cardInfo.damage;
            MP -= cardInfo.mana;
            switch(tile.type)
            {
                case POWER:
                    damage = damage * (100 + tile.n) / 100;
                    break;
                case CHAOS: // 현재 턴의 내카드 + 상대카드를 시드값으로 랜덤 카드 선택
                    srand(myCard+oppCard);
                    cardInfo = SkillCardMap.at(static_cast<Card>((rand() % 41) + 10));
                    damage = cardInfo.damage;
                    break;
            }

            // 범위 내 적 판별
            for(int i = 0; i < 9; i++)
            {
                if(cardInfo.range[i] &&
                ((r+dir[i][0] == oppCharacter.r && c+dir[i][1] == oppCharacter.c) ||    // 실제 범위 판별
                (board[oppCharacter.r][oppCharacter.c].type == LINK && r+dir[i][0] == board[oppCharacter.r][oppCharacter.c].r2 && c+dir[i][1] == board[oppCharacter.r][oppCharacter.c].c2)))    // 링크 범위 판별
                {
                    if(oppCharacter.isPerfectGuard)
                        break;
                    if(oppCharacter.isGuard)
                        damage -= 15;
                    oppCharacter.HP -= damage;
                    break;
                }
            }
        }
    }
};

class JudgeServer
{
public:
    int turn = 1;
    TileState board[3][4];
    CharacterState p1, p2;
    Card canUseP1[14], canUseP2[14];

    JudgeServer() {
        p1.SetPosition(1, 0); // P1은 왼쪽
        p2.SetPosition(1, 3); // P2는 오른쪽
        
        // 보드 초기화
        for(int r=0; r<3; r++)
            for(int c=0; c<4; c++)
                board[r][c] = {NORMAL, 0, r, c, 0, 0, 0, 0, 0};
    }

    bool CanUseCard(Card canUseCard[14], Card card)
    {
        for(int i = 0; i < 14; i++)
            if(canUseCard[i] == card)
                return true;
        return false;
    }

    void SimulateRound(Behavior p1_behavior, Behavior p2_raw_behavior)
    {
        for (int i = 0; i < 3; i++)
        {
            Card c1 = p1_behavior.card[i];
            if(!CanUseCard(canUseP1, c1)) p1Result = ERROR;
            Card c2_raw = p2_raw_behavior.card[i];
            if(!CanUseCard(canUseP2, c2_raw)) p2Result = ERROR;
            
            // P2의 카드를 절대 좌표계 카드로 변환
            Card c2 = GetSymmetricCard(c2_raw);

            // 방어 상태 초기화 및 마나 지불
            p1.isGuard = p1.isPerfectGuard = false;
            p2.isGuard = p2.isPerfectGuard = false;
            
            p1.ApplyCard(board, c1, c2, p2);
            p2.ApplyCard(board, c2, c1, p1);
            
            // 마나가 부족하면 카드를 발동하지 못함
            if(p1.MP < 0) p1Result = ERROR;
            if(p2.MP < 0) p2Result = ERROR;
            
            if(p1.HP < 0) p1Result = LOSE;
            if(p2.HP < 0) p2Result = LOSE;

            if(p1Result != WIN || p2Result != WIN)
                return;
            
            for(int j = 0; j < 3; j++)
                for(int k = 0; k < 4; k++)
                    if(board[j][k].type != NORMAL && --board[j][k].remainTurn == 0)
                    {
                        board[j][k].type = NORMAL;
                    }
        }

        // 라운드 종료 후 마나 회복
        p1.MP = min(100, p1.MP + 15);
        p2.MP = min(100, p2.MP + 15);
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

    writeLine(p1.write_fd, "READY");
    writeLine(p2.write_fd, "READY");

    string p1_ready = readLine(p1.read_fd);
    if(p1_ready.empty()) p1Result = ERROR;
    string p2_ready = readLine(p2.read_fd);
    if(p2_ready.empty()) p2Result = ERROR;
    if (p1Result != WIN || p2Result != WIN) {
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << endl;
        writeLine(p1.write_fd, "FINISH");
        writeLine(p2.write_fd, "FINISH");
        return 0;
    }

    // 캐릭터, 선택 카드 파싱
    stringstream ss1(p1_ready), ss2(p2_ready);
    string c1_str, c2_str;
    ss1 >> c1_str;
    try{
        judge.p1.character = StringToEnum<Character>(c1_str);
        cout << "READY " << c1_str << " ";
        int p = 0;
        for(int i = 0; i < 4; i++)
            judge.canUseP1[p++] = static_cast<Card>(i);
        judge.canUseP1[p++] = static_cast<Card>(7);
        judge.canUseP1[p++] = static_cast<Card>(8);
        for(int i = 0; i < 5; i++)
            judge.canUseP1[p++] = static_cast<Card>(11 + (int)judge.p1.character*5 + i);
        string card_str;
        for(int i = 0; i < 3; i++)
        {
            ss1 >> card_str;
            cout << card_str << " ";
            judge.canUseP1[p++] = StringToEnum<Card>(card_str);
        }
        cout << "\n";
    }catch(const exception& e){
        p1Result = ERROR;
    }
    ss2 >> c2_str;
    try{
        judge.p2.character = StringToEnum<Character>(c2_str);
        cout << "READY " << c2_str << " ";
        int p = 0;
        for(int i = 0; i < 4; i++)
            judge.canUseP2[p++] = static_cast<Card>(i);
        judge.canUseP2[p++] = static_cast<Card>(7);
        judge.canUseP2[p++] = static_cast<Card>(8);
        for(int i = 0; i < 5; i++)
            judge.canUseP2[p++] = static_cast<Card>(11 + (int)judge.p2.character*5 + i);
        string card_str;
        for(int i = 0; i < 3; i++)
        {
            ss2 >> card_str;
            cout << card_str << " ";
            judge.canUseP2[p++] = StringToEnum<Card>(card_str);
        }
        cout << "\n";
    }catch(const exception& e){
        p1Result = ERROR;
    }
    if (p1Result != WIN || p2Result != WIN) {
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << endl;
        writeLine(p1.write_fd, "FINISH");
        writeLine(p2.write_fd, "FINISH");
        return 0;
    }
    // 상대방 캐릭터 알려주기
    writeLine(p1.write_fd, "SELECT " + c2_str);
    writeLine(p2.write_fd, "SELECT " + c1_str);

    for (int round = 1; judge.p1.HP > 0 && judge.p2.HP > 0 && round <= 20; round++) {
        cout << "ROUND " << round << "\n";
        writeLine(p1.write_fd, "SET");
        string p1_set = readLine(p1.read_fd);
        Behavior b1;
        if (p1_set.empty()) {
            p1Result = ERROR;
        }
        else
        {
            stringstream set1(p1_set);
            set1 >> command;
            if(command != "SET")
                p1Result = ERROR;
            try{
                for(int i = 0; i < 3; i++)
                {
                    string s;
                    set1 >> s;
                    cout << s << " ";
                    b1.card[i] = StringToEnum<Card>(s);
                }
            }catch(const exception& e){
                p1Result = ERROR;
            }
            cout << "\n";
        }
        
        writeLine(p2.write_fd, "SET");
        string p2_set = readLine(p2.read_fd);
        Behavior b2;
        if (p2_set.empty()) {
            p2Result = ERROR;
        }
        else
        {
            stringstream set2(p2_set);
            set2 >> command;
            if(command != "SET")
                p2Result = ERROR;
            try{
                for(int i = 0; i < 3; i++)
                {
                    string s;
                    set2 >> s;
                    cout << s << " ";
                    b2.card[i] = StringToEnum<Card>(s);
                }
            }catch(const exception& e){
                p2Result = ERROR;
            }
            cout << "\n";
        }
        
        judge.SimulateRound(b1, b2);
        if (judge.p1.HP <= 0) p1Result = LOSE;
        if (judge.p2.HP <= 0) p2Result = LOSE;

        if (p1Result != WIN || p2Result != WIN) {
            cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << endl;
            writeLine(p1.write_fd, "FINISH");
            writeLine(p2.write_fd, "FINISH");
            return 0;
        }

        string opp_for_p1 = "OPP " + EnumToString(GetSymmetricCard(b2.card[0])) + " " + EnumToString(GetSymmetricCard(b2.card[1])) + " " + EnumToString(GetSymmetricCard(b2.card[2]));
        string opp_for_p2 = "OPP " + EnumToString(GetSymmetricCard(b1.card[0])) + " " + EnumToString(GetSymmetricCard(b1.card[1])) + " " + EnumToString(GetSymmetricCard(b1.card[2]));

        writeLine(p1.write_fd, opp_for_p1);
        writeLine(p2.write_fd, opp_for_p2);

        // 특수 타일 생성
        TileState newTile;
        newTile.type = static_cast<Tile>((rand() % 6) + 1); // 1~6 (POWER~LOCK) 랜덤
        newTile.r = rand() % 3;
        newTile.c = rand() % 4;
        newTile.remainTurn = (rand() % 3) + 3; // 기본 유지 턴수

        string t1_msg = "TILE " + EnumToString(newTile.type) + " ";

        if (newTile.type == POWER || newTile.type == HP_FLUX || newTile.type == MANA_FLUX) {
            newTile.n = (rand() % 14) - 7;
            t1_msg += to_string(newTile.r) + " " + to_string(newTile.c) + " " + to_string(newTile.n) + " " + to_string(newTile.remainTurn);
        } 
        else if (newTile.type == LINK) {
            newTile.r1 = newTile.r; newTile.c1 = newTile.c;
            do {
                newTile.r2 = rand() % 3; newTile.c2 = rand() % 4;
            } while(newTile.r1 == newTile.r2 && newTile.c1 == newTile.c2);
            t1_msg += to_string(newTile.r1) + " " + to_string(newTile.c1) + " " + to_string(newTile.r2) + " " + to_string(newTile.c2) + " " + to_string(newTile.remainTurn);
            judge.board[newTile.r2][newTile.c2] = newTile; // 글로벌 보드에 연결점 저장
        } 
        else { // CHAOS, LOCK
            t1_msg += to_string(newTile.r) + " " + to_string(newTile.c) + " " + to_string(newTile.remainTurn);
        }

        // 글로벌 보드에 타일 덮어쓰기
        judge.board[newTile.r][newTile.c] = newTile;

        // P2를 위해 점대칭 좌표 변환하여 메시지 작성
        TileState symTile = GetSymmetricTile(newTile);
        string t2_msg = "TILE " + EnumToString(symTile.type) + " ";
        
        if (symTile.type == POWER || symTile.type == HP_FLUX || symTile.type == MANA_FLUX) {
            t2_msg += to_string(symTile.r) + " " + to_string(symTile.c) + " " + to_string(symTile.n) + " " + to_string(symTile.remainTurn);
        } 
        else if (symTile.type == LINK) {
            t2_msg += to_string(symTile.r1) + " " + to_string(symTile.c1) + " " + to_string(symTile.r2) + " " + to_string(symTile.c2) + " " + to_string(symTile.remainTurn);
        } 
        else {
            t2_msg += to_string(symTile.r) + " " + to_string(symTile.c) + " " + to_string(symTile.remainTurn);
        }

        // 양측 봇에 타일 생성 정보 전송
        writeLine(p1.write_fd, t1_msg);
        writeLine(p2.write_fd, t2_msg);
    }
    
    cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << endl;
    writeLine(p1.write_fd, "FINISH");
    writeLine(p2.write_fd, "FINISH");
    waitpid(p1.pid, nullptr, 0);
    waitpid(p2.pid, nullptr, 0);
    return 0;
}