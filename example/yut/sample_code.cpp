#include <iostream>
#include <vector>
#include <string>
#include <sstream>

using namespace std;

int main() {
    // 입출력 속도 향상
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int my_skills[2], opp_skills[2];

    string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        stringstream ss(line);
        string cmd;
        ss >> cmd;

        // 🔴 누락되었던 READY 처리 추가!
        if (cmd == "READY") {
            cout << "OK\n" << flush;
        } 
        else if (cmd == "INIT") {
            ss >> my_skills[0] >> my_skills[1] >> opp_skills[0] >> opp_skills[1];
        } 
        else if (cmd == "REQ") {
            int m_time, o_time, can_roll, rolled, skilled;
            int ms1_left, ms2_left, os1_left, os2_left, bomb;
            int mp[4], op[4], y_cnt;
            vector<int> yuts;

            ss >> m_time >> o_time >> can_roll >> rolled >> skilled 
               >> ms1_left >> ms2_left >> os1_left >> os2_left >> bomb;
            
            for(int i=0; i<4; i++) ss >> mp[i];
            for(int i=0; i<4; i++) ss >> op[i];
            
            ss >> y_cnt;
            for(int i=0; i<y_cnt; i++) {
                int y; ss >> y; yuts.push_back(y);
            }

            // [1] 스킬 조건 만족 시 난사 (테스트용 무지성 발동)
            if (!rolled && !skilled) {
                if (ms2_left) { cout << "SKILL " << my_skills[1] << " 0 0\n" << flush; continue; }
                if (ms1_left) { cout << "SKILL " << my_skills[0] << " 0 0\n" << flush; continue; }
            }

            // [2] 윷 던지기가 가능하면 무조건 던짐
            if (can_roll) {
                cout << "ROLL\n" << flush;
                continue;
            }

            // [3] 이동 (윷 수치가 있으면 이동)
            if (y_cnt > 0) {
                int yut_to_use = yuts[0];
                int target_pid = -1;

                // 빽도(-1)일 경우 필드(>0) 위 말 우선 선택
                if (yut_to_use == -1) {
                    for (int i=0; i<4; i++) {
                        if (mp[i] > 0) { target_pid = i; break; }
                    }
                } 
                // 도~모 양수일 경우 아무 말이나(대기 중 -1번 포함) 찾기
                else {
                    for (int i=0; i<4; i++) {
                        if (mp[i] != 0) { target_pid = i; break; }
                    }
                }

                if (target_pid != -1) {
                    cout << "MOVE " << target_pid << " " << yut_to_use << "\n" << flush;
                } else {
                    // 예외 방지: 고를 수 있는 말이 없으면 0번을 고름 (결승점 예외는 채점기가 처리)
                    cout << "MOVE 0 " << yut_to_use << "\n" << flush; 
                }
                continue;
            }

            // [4] 아무 행동도 할 수 없으면 턴 넘기기
            cout << "PASS\n" << flush;
        } 
        else if (cmd == "FINISH") {
            break;
        }
    }
    return 0;
}