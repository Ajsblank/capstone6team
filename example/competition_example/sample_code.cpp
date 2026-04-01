#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <magic_enum.hpp>

using namespace std;
using namespace magic_enum;

// 가능한 캐릭터 종류들을 나타내는 enum
enum Character
{
    c001, c002, c003, c004, c005, c006, c007, c008
}

// 가능한 카드 종류들을 나타내는 enum
enum Card
{
    UP, DOWN, LEFT, RIGHT, GUARD, MANA_HEAL,    // [공용 카드]

    DDOUBLE_RIGHT, DOUBLE_LEFT, HEAL, PERFECT_GUARD, R, // [선택 카드]

    // [캐릭터 카드]
    c001_A, c001_B, c001_C, c001_D, c001_E,
    c002_A, c002_B, c002_C, c002_D, c002_E,
    c003_A, c003_B, c003_C, c003_D, c003_E,
    c004_A, c004_B, c004_C, c004_D, c004_E,
    c005_A, c005_B, c005_C, c005_D, c005_E,
    c006_A, c006_B, c006_C, c006_D, c006_E,
    c007_A, c007_B, c007_C, c007_D, c007_E,
    c008_A, c008_B, c008_C, c008_D, c008_E,
}

// CENTER, UP, UP_RIGHT, RIGHT, DOWN_RIGHT, DOWN, DOWN_LEFT, LEFT, UP_LEFT
int dir[9][2] = {{0,0},{-1,0},{-1,1},{0,1},{1,1},{1,0},{1,-1},{0,-1},{-1,-1},};

// 카드의 고유 속성을 담는 구조체
struct SkillCardInfo
{
    string name;        // 카드 이름
    int damage;         // 가하는 데미지
    int cost;           // 소모 마나
    bool range[9];      // 범위
};

// 게임 내 모든 카드의 능력치를 저장하는 읽기 전용 데이터베이스
const unordered_map<Card, CardInfo> SkillCardMap = {

    // [001 캐릭터]
    { c001_A, { "001_A", 30, 25, { true,  true, false, false, false,  true, false, false, false } } },
    { c001_B, { "001_B", 50, 50, { true, false, false, false,  true,  true,  true, false, false } } },
    { c001_C, { "001_C", 25, 25, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c001_D, { "001_D", 25, 35, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c001_E, { "001_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [002 캐릭터]
    { c002_A, { "002_A", 50, 50, { true, false,  true, false, false, false, false, false,  true } } },
    { c002_B, { "002_B", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c002_C, { "002_C", 25, 15, { true, false, false,  true, false, false, false,  true, false } } },
    { c002_D, { "002_D", 25, 25, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c002_E, { "002_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [003 캐릭터]
    { c003_A, { "003_A", 40, 45, { true, false, false,  true, false, false, false,  true, false } } },
    { c003_B, { "003_B", 25, 30, { true,  true,  true, false,  true,  true,  true, false,  true } } },
    { c003_C, { "003_C", 15, 25, {false, false,  true,  true,  true, false,  true,  true,  true } } },
    { c003_D, { "003_D", 30, 20, { true,  true, false, false, false,  true, false, false, false } } },
    { c003_E, { "003_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [004 캐릭터]
    { c004_A, { "004_A", 50, 50, { true,  true,  true, false, false, false, false, false,  true } } },
    { c004_B, { "004_B", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c004_C, { "004_C", 25, 35, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c004_D, { "004_D", 25, 20, { true, false, false,  true, false, false, false,  true, false } } },
    { c004_E, { "004_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [005 캐릭터]
    { c005_A, { "005_A", 40, 50, { true, false,  true,  true,  true, false,  true,  true,  true } } },
    { c005_B, { "005_B", 25, 30, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c005_C, { "005_C", 25, 15, { true, false, false,  true, false, false, false,  true, false } } },
    { c005_D, { "005_D", 25, 30, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c005_E, { "005_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [006 캐릭터]
    { c006_A, { "006_A", 35, 25, { true, false, false,  true, false, false, false,  true, false } } },
    { c006_B, { "006_B", 50, 45, { true, false, false, false,  true,  true,  true, false, false } } },
    { c006_C, { "006_C", 25, 15, { true,  true, false,  true, false, false, false,  true, false } } },
    { c006_D, { "006_D", 20, 35, { true, false,  true,  true,  true, false,  true,  true,  true } } },
    { c006_E, { "006_E", 25, 40, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },

    // [007 캐릭터]
    { c007_A, { "007_A", 40, 50, {false,  true,  true,  true,  true,  true,  true,  true,  true } } },
    { c007_B, { "007_B", 25, 25, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c007_C, { "007_C", 60, 50, { true, false, false, false, false,  true, false, false, false } } },
    { c007_D, { "007_D", 30, 20, { true, false, false,  true, false, false, false,  true, false } } },
    { c007_E, { "007_E", 25, 15, {false, false, false,  true,  true, false,  true,  true, false } } },

    // [008 캐릭터]
    { c008_A, { "008_A", 60, 70, {false, false, false,  true, false, false, false,  true, false } } },
    { c008_B, { "008_B", 20, 15, { true, false, false,  true,  true,  true,  true,  true, false } } },
    { c008_C, { "008_C", 40, 50, { true,  true, false,  true, false,  true, false,  true, false } } },
    { c008_D, { "008_D", 25, 20, { true, false,  true, false,  true, false,  true, false,  true } } },
    { c008_E, { "008_E", 15, 15, { true,  true,  true,  true,  true,  true,  true,  true,  true } } },
};

// 캐릭터 상태를 관리하는 클래스
class CharacterState
{
public:
    Character character;    // 캐릭터 종류
    int r, c;   // 캐릭터 위치 (r, c)
    int HP, MP; // HP, MP
    CharacterState() {
        HP = 100;
        MP = 100;
    }

    SetPosition(int r, int c)
    {
        this.r = r;
        this.c = c;
    }

    ApplyCard()
    {

    }
}

// 게임 상태를 관리하는 클래스
class Game
{
private:
    int round, turn;                        // 현재 라운드, 현재 턴
    int board[3][4];                        // 게임 보드 (2차원 배열)
    Character myCharacter, oppCharacter;    //내 캐릭터, 상대 캐릭터 상태

public:
    Game() {
        myCharacter.SetPosition(1, 0);
        oppCharacter.SetPosition(1, 3);
    }

    // ================================================================
    // ===================== [필수 구현] ===============================

    // 플레이할 캐릭터 및 선택 카드 3장 선택
    void selectCharacterAndCard()
    {

    }
    
    // 다음 라운드에 행동할 카드 3장을 순서대로 선택
    vector<string> SelectCard()
    {

    }
    // =================== [필수 구현 끝] =============================

    // 라운드 진행
    void PlayRound()
    {

    }
}

int main()
{
    Game game;

    while(true)
    {
        string line;
        getline(cin, line);
        istringstream iss(line);
        string command;
        if(!!(iss >> command))
            continue;

        // 선택한 캐릭터 및 선택카드 3장 출력
        if(command == "READY")
        {
            game.SelectCharacterAndCard();
        }

        // 상대방 캐릭터 선택 결과 받기
        if(command == "SELECT")
        {
            string character;
            iss >> character;
            game.oppCharacter.character = enum_cast<Character>(character);
        }

        // 해당 라운드에 상대방의 카드 선택 결과 받기
        if(command == "OPP")
        {
            string card0, card1, card2;
            iss >> card0 >> card1 >> card2;
            
        }

        // 다음 라운드부터 변경될 타일 정보 받기
        if(command == "TILE")
        {
            string tile;
            iss >> tile;
            
        }

        // 게임 종료
        if(command == "FINISH")
            break;

        // 올바르지 않은 명령어 처리
        cerr << "Invaild command: " << command << endl;
        return 1;
    }
}