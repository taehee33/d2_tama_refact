import { renderHook } from "@testing-library/react";
import { useGamePageEvolutionAvailability } from "./useGamePageEvolutionAvailability";

describe("useGamePageEvolutionAvailability", () => {
  test("로딩 중에는 evo 버튼을 비활성화한다", () => {
    const setIsEvoEnabled = jest.fn();

    renderHook(() =>
      useGamePageEvolutionAvailability({
        isLoadingSlot: true,
        digimonStats: { isDead: false },
        developerMode: false,
        ignoreEvolutionTime: false,
        selectedDigimon: "Agumon",
        evolutionDataForSlot: {},
        setIsEvoEnabled,
        customTime: 0,
      })
    );

    expect(setIsEvoEnabled).toHaveBeenCalledWith(false);
  });

  test("customTime이 바뀌면 조건을 다시 계산한다", () => {
    const setIsEvoEnabled = jest.fn();

    const { rerender } = renderHook(
      ({ customTime }) =>
        useGamePageEvolutionAvailability({
          isLoadingSlot: false,
          digimonStats: {
            isDead: false,
            timeToEvolveSeconds: 0,
          },
          developerMode: false,
          ignoreEvolutionTime: false,
          selectedDigimon: "Agumon",
          evolutionDataForSlot: {
            Agumon: {
              evolutionCriteria: {
                timeToEvolveSeconds: 0,
              },
              evolutions: [{ targetId: "Greymon" }],
            },
            Greymon: {
              id: "Greymon",
              name: "그레이몬",
            },
          },
          setIsEvoEnabled,
          customTime,
        }),
      {
        initialProps: { customTime: 0 },
      }
    );

    expect(setIsEvoEnabled).toHaveBeenLastCalledWith(true);

    rerender({ customTime: 1 });

    expect(setIsEvoEnabled).toHaveBeenCalledTimes(2);
    expect(setIsEvoEnabled).toHaveBeenLastCalledWith(true);
  });
});
