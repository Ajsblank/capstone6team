example/competition_example/sample_code.cpp#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <cassert>
#include <type_traits>
#include <unordered_map>
#include <cstdlib>

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

// 캐릭터 상태를 관리하는 클래스
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

// 게임 상태를 관리하는 클래스
class Game
{
public:
    int round = 1, turn = 1;                             // 현재 라운드, 현재 턴
    TileState board[3][4];                       // 게임 보드 (2차원 배열)
    CharacterState myCharacter, oppCharacter;    //내 캐릭터, 상대 캐릭터 상태
    Behavior myBehavior;

    Game() {
        myCharacter.SetPosition(1, 0);
        oppCharacter.SetPosition(1, 3);
    }

    // ============================================================
    // ====================== [필수 구현] ==========================

    // 플레이할 캐릭터 및 선택 카드 3장 선택
    InitGame SelectCharacterAndCard()
    {
        InitGame initgame;
        initgame.character = c001;
        initgame.selectCard[0] = PERFECT_GUARD;
        initgame.selectCard[1] = DOUBLE_LEFT;
        initgame.selectCard[2] = HEAL;
        return initgame;
    }
    
    // 다음 라운드에 행동할 카드 3장을 순서대로 선택
    Behavior SelectCard()
    {
        // 랜덤 카드 선택
        Card canUseCard[14] = {UP, DOWN, LEFT, RIGHT, c001_A, c001_B, c001_C, c001_D, c001_E, MANA_HEAL, GUARD, HEAL, DOUBLE_LEFT, PERFECT_GUARD};
        while(true)
        {
            int order[3] = {rand() % 14, rand() % 14, rand() % 14};
            if(order[0] == order[1] || order[0] == order[2] || order[1] == order[2])
                continue;
            for(int i = 0; i < 3; i++)
                myBehavior.card[i] = canUseCard[order[i]];
            if(IsValidBehavior(myBehavior))
                break;
        }
        return myBehavior;
    }
    // ====================== [필수 구현 끝] =======================

    // 선택한 카드가 해당 라운드에 사용할 수 있는 행동인지 판단
    bool IsValidBehavior(Behavior& behavior)
    {
        // 현재 내 캐릭터의 상태를 시뮬레이션용 변수에 복사
        int simR = myCharacter.r;
        int simC = myCharacter.c;
        int simMP = myCharacter.MP;

        for (int i = 0; i < 3; i++)
        {
            Card card = behavior.card[i];
            TileState tile = board[simR][simC];

            // MP 관련 타일
            if (tile.type == MANA_FLUX)
            {
                simMP += tile.n;
            }

            int manaCost = 0;
            if (card == HEAL) manaCost = 60;
            else if (card == PERFECT_GUARD) manaCost = 25;
            else if (card > PERFECT_GUARD) manaCost = SkillCardMap.at(card).mana;

            // 현재 마나가 소모량보다 적어 불가
            if (simMP < manaCost)
            {
                return false;
            }

            simMP -= manaCost;
            if (card == MANA_HEAL)
            {
                simMP = min(100, simMP + 15);
            }

            if (card <= DOUBLE_RIGHT)
            {
                // 변화량
                int dr = 0, dc = 0;
                switch (card)
                {
                    case UP: dr = -1; break;
                    case DOWN: dr = 1; break;
                    case LEFT: case DOUBLE_LEFT: dc = -1; break;
                    case RIGHT: case DOUBLE_RIGHT: dc = 1; break;
                }
                // 첫 번째 칸 이동 (맵 범위 내 & LOCK 타일이 아닐 때)
                if (simR + dr >= 0 && simR + dr < 3 && simC + dc >= 0 && simC + dc < 4 && board[simR + dr][simC + dc].type != LOCK)
                {
                    simR += dr;
                    simC += dc;
                }
                // 두 번째 칸 이동 (DOUBLE 이동기일 때 한 번 더)
                if ((card == DOUBLE_LEFT || card == DOUBLE_RIGHT) && simR + dr >= 0 && simR + dr < 3 && simC + dc >= 0 && simC + dc < 4 && board[simR + dr][simC + dc].type != LOCK)
                {
                    simR += dr;
                    simC += dc;
                }
            }
        }

        return true;
    }

    // 라운드 진행
    void PlayRound(Behavior oppBehavior)
    {
        for(int i = 0; i < 3; i++)
        {
            if(myBehavior.card[i] <= oppBehavior.card[i])
            {
                myCharacter.ApplyCard(board, myBehavior.card[i], oppBehavior.card[i], oppCharacter);
                oppCharacter.ApplyCard(board, oppBehavior.card[i], myBehavior.card[i], myCharacter);
            }
            else
            {
                oppCharacter.ApplyCard(board, oppBehavior.card[i], myBehavior.card[i], myCharacter);
                myCharacter.ApplyCard(board, myBehavior.card[i], oppBehavior.card[i], oppCharacter);
            }
            myCharacter.isGuard = false;
            myCharacter.isPerfectGuard = false;
            oppCharacter.isGuard = false;
            oppCharacter.isPerfectGuard = false;
            turn++;
            for(int j = 0; j < 3; j++)
                for(int k = 0; k < 4; k++)
                    if(board[j][k].type != NORMAL && --board[j][k].remainTurn == 0)
                    {
                        board[j][k].type = NORMAL;
                    }

        }
        // 라운드 종료 시 MP 회복
        myCharacter.MP = min(100, myCharacter.MP+15);
        oppCharacter.MP = min(100, oppCharacter.MP+15);
        round++;
    }

    // 타일 변경
    void SetTile(TileState tile)
    {
        board[tile.r][tile.c] = tile;
    }
};

int main()
{
    Game game;
    srand((unsigned int)time(NULL));

    while(true)
    {
        string line;
        getline(cin, line);
        istringstream iss(line);
        string command;
        if(!(iss >> command))
            continue;

        // 선택한 캐릭터 및 선택카드 3장 출력
        if(command == "READY")
        {
            InitGame initgame = game.SelectCharacterAndCard();
            cout << EnumToString(initgame.character) << " " << EnumToString(initgame.selectCard[0]) << " " << EnumToString(initgame.selectCard[1]) << " " << EnumToString(initgame.selectCard[2]) << endl;

            continue;
        }

        // 상대방 캐릭터 선택 결과 받기
        if(command == "SELECT")
        {
            string character;
            iss >> character;
            game.oppCharacter.character = StringToEnum<Character>(character);

            continue;
        }

        // 다음 라운드 카드 순서 선택
        if(command == "SET")
        {
            Behavior myBehavior;
            myBehavior = game.SelectCard();
            cout << "SET " << EnumToString(myBehavior.card[0]) << " " << EnumToString(myBehavior.card[1]) << " " << EnumToString(myBehavior.card[2]) << endl;

            continue;
        }

        // 해당 라운드에 상대방의 카드 선택 결과 받기
        if(command == "OPP")
        {
            string str;
            Behavior oppBehavior;
            for(int i = 0; i < 3; i++)
            {
                iss >> str;
                oppBehavior.card[i] = StringToEnum<Card>(str);
            }
            game.PlayRound(oppBehavior);
            
            continue;
        }

        // 다음 라운드부터 변경될 타일 정보 받기
        if(command == "TILE")
        {
            string str;
            TileState tile;
            iss >> str;
            tile.type = StringToEnum<Tile>(str);
            switch(tile.type)
            {
                case POWER:
                case HP_FLUX:
                case MANA_FLUX:
                    iss >> tile.r >> tile.c >> tile.n >> tile.remainTurn;
                    break;
                case LINK:
                    iss >> tile.r1 >> tile.c1 >> tile.r2 >> tile.c2 >> tile.remainTurn;
                    tile.r = tile.r1;
                    tile.c = tile.c1;
                    TileState linkTile;
                    linkTile.type = tile.type;
                    linkTile.r = tile.r2;
                    linkTile.c = tile.c2;
                    linkTile.r1 = tile.r1;
                    linkTile.c1 = tile.c1;
                    linkTile.r2 = tile.r2;
                    linkTile.c2 = tile.c2;
                    game.SetTile(linkTile);
                    break;
                case CHAOS:
                case LOCK:
                    iss >> tile.r >> tile.c >> tile.remainTurn;
                    break;
            }
            game.SetTile(tile);
            
            continue;
        }

        // 게임 종료
        if(command == "FINISH")
            break;

        // 올바르지 않은 명령어 처리
        cerr << "Invaild command: " << command << endl;
        return 1;
    }
}