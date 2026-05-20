#pragma warning disable CS1998
#if CLIENT
namespace GameEntry
{
    partial class Scope : GameCore.BaseInterface.IGameClass
    {
        static void OnGameTriggerInitialization()
        {
            OnGameTriggerInitialization_CommonInitializers();
        }

        static public void OnRegisterGameClass()
        {
            Game.OnGameTriggerInitialization += OnGameTriggerInitialization;
        }
    }
}
#endif
#pragma warning restore CS1998
